import { fromAshby, fromGreenhouse, fromLever } from "./normalize";
import { SOURCES, type Board, type BoardResult, type Fetcher, type Job, type Source } from "./types";

/** How long to wait for a board. Ashby and Lever send full descriptions, so a big board is several megabytes. */
export const BOARD_TIMEOUT_MS = 10_000;

const TOKEN = /^[a-z0-9-]{1,64}$/;

const LINK_HOSTS: Record<string, Source> = {
  "job-boards.greenhouse.io": "greenhouse",
  "boards.greenhouse.io": "greenhouse",
  "jobs.ashbyhq.com": "ashby",
  "jobs.lever.co": "lever",
};

export interface Candidate {
  /** Set when the input was a job link, so only that system is asked. */
  source?: Source;
  token: string;
}

function looksLikeLink(input: string): boolean {
  return /^https?:\/\//i.test(input) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(input);
}

function fromLink(input: string): Candidate[] {
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    const source = LINK_HOSTS[url.hostname.toLowerCase()];
    const token = (url.pathname.split("/")[1] ?? "").toLowerCase();
    return source && TOKEN.test(token) ? [{ source, token }] : [];
  } catch {
    return [];
  }
}

/** The board names to try for what someone typed: a job link gives one exact board, a company name gives
 *  "scaleai" and "scale-ai". Anything that is not a safe board name is dropped before any request is made. */
export function candidates(input: string): Candidate[] {
  const trimmed = input.trim();
  if (looksLikeLink(trimmed)) return fromLink(trimmed);
  const words = trimmed.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const tokens = [...new Set([words.join(""), words.join("-")])];
  return tokens.filter((token) => TOKEN.test(token)).map((token) => ({ token }));
}

function boardUrl(source: Source, token: string): string {
  if (source === "greenhouse") return `https://boards-api.greenhouse.io/v1/boards/${token}/jobs`;
  if (source === "ashby") return `https://api.ashbyhq.com/posting-api/job-board/${token}`;
  return `https://api.lever.co/v0/postings/${token}?mode=json`;
}

function parse(source: Source, raw: unknown, token: string, label: string): Board | null {
  if (source === "greenhouse") return fromGreenhouse(raw, token);
  if (source === "ashby") return fromAshby(raw, token, label);
  return fromLever(raw, token, label);
}

/** One company's open jobs. `label` names the company for systems that do not send a name (Ashby, Lever). */
export async function fetchBoard(source: Source, token: string, label: string, fetcher: Fetcher = fetch): Promise<BoardResult> {
  const url = boardUrl(source, token);
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(BOARD_TIMEOUT_MS) });
    if (response.status === 404) return { kind: "not-found" };
    if (!response.ok) {
      console.error(`Jobs: ${url} answered ${response.status}`);
      return { kind: "unavailable" };
    }
    const board = parse(source, await response.json(), token, label);
    if (board === null) {
      console.error(`Jobs: ${url} sent something that is not a job list`);
      return { kind: "unavailable" };
    }
    return { kind: "found", source, board: token, ...board };
  } catch (error) {
    console.error(`Jobs: ${url} could not be read`, error);
    return { kind: "unavailable" };
  }
}

/** Ashby and Lever send no company name, so a company found from a link is named after its board: "scale-ai" reads
 *  "Scale Ai" (user, 2026-10-26: "spotify" in lower case looked like a mistake). */
function nameFromToken(token: string): string {
  return token.split("-").filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

/** Finds a company by name or job link: each board name is tried on Greenhouse, then Ashby, then Lever, and the
 *  first board with jobs wins. An empty board is kept only if no other has jobs, because companies that moved
 *  systems leave empty boards behind (Webflow, Squarespace on Greenhouse). Not found only when every system said
 *  so; unavailable when one of them could not answer. */
export async function findCompany(
  input: string,
  fetcher: Fetcher = fetch,
  // The server passes its cached version (service.ts), so a company just found is already cached for the first search
  getBoard: (source: Source, token: string, label: string) => Promise<BoardResult> = (s, t, l) => fetchBoard(s, t, l, fetcher),
): Promise<BoardResult> {
  const tries = candidates(input);
  const label = looksLikeLink(input.trim()) ? nameFromToken(tries[0]?.token ?? "") : input.trim();
  let empty: BoardResult | null = null;
  let unavailable = false;
  for (const { source, token } of tries) {
    for (const each of source ? [source] : SOURCES) {
      const result = await getBoard(each, token, label);
      if (result.kind === "found" && result.jobs.length > 0) return result;
      if (result.kind === "found") empty ??= result;
      if (result.kind === "unavailable") unavailable = true;
    }
  }
  if (empty) return empty;
  return unavailable ? { kind: "unavailable" } : { kind: "not-found" };
}

/** Jobs whose title holds every word of the search, ignoring case. An empty search keeps them all. */
export function matchJobs(jobs: Job[], query: string): Job[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return jobs.filter((job) => {
    const title = job.title.toLowerCase();
    return words.every((word) => title.includes(word));
  });
}
