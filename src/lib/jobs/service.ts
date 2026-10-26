import { createCache } from "./cache";
import { matchJobs } from "./boards";
import { SOURCES, type BoardResult, type Job, type Source } from "./types";

/** What the server routes do with the job boards, kept apart from Next.js so it can be tested without a server. */

/** Each board's trimmed job list (at most about 230 KB) is kept for 10 minutes and shared by everyone following that
 *  company; the raw answer (up to 13.5 MB) is never kept (AGENTS.md). */
export const BOARD_CACHE_MS = 10 * 60 * 1000;
const BOARD_CACHE_SIZE = 200;
/** One page of search results; the page says how many more there were. */
export const MAX_RESULTS = 50;
const MAX_NAME = 200;
const MAX_QUERY = 100;
const TOKEN = /^[a-z0-9-]{1,64}$/;

export type BoardGetter = (source: Source, token: string, label: string) => Promise<BoardResult>;

export interface Company {
  source: Source;
  board: string;
  name: string;
}

export type CompanySummary =
  | { kind: "found"; source: Source; board: string; company: string; openRoles: number }
  | { kind: "not-found" }
  | { kind: "unavailable" };

export interface SearchResult {
  jobs: Job[];
  total: number;
  /** Followed companies whose hiring system didn't answer this time. */
  unavailable: string[];
  /** Open roles per followed company ("greenhouse:figma"), null when its system didn't answer; the Jobs page lists them. */
  openRoles: Record<string, number | null>;
}

export const companyKey = (c: { source: Source; board: string }) => `${c.source}:${c.board}`;

/** A company name or job link from the browser, trimmed; null when empty or too long to be either. */
export function readName(raw: string | null): string | null {
  const name = raw?.trim() ?? "";
  return name.length > 0 && name.length <= MAX_NAME ? name : null;
}

/** A title search from the browser; empty is fine (newest roles), too long is refused. */
export function readQuery(raw: string | null): string | null {
  const query = raw?.trim() ?? "";
  return query.length <= MAX_QUERY ? query : null;
}

/** A followed company read from the database, checked again before its board name goes into an address. */
export function rowToCompany(row: unknown): Company | null {
  if (typeof row !== "object" || row === null) return null;
  const { source, board_token, name } = row as Record<string, unknown>;
  if (!SOURCES.includes(source as Source) || typeof board_token !== "string" || !TOKEN.test(board_token)) return null;
  if (typeof name !== "string" || name.length === 0) return null;
  return { source: source as Source, board: board_token, name };
}

export function summarize(result: BoardResult): CompanySummary {
  if (result.kind !== "found") return result;
  return { kind: "found", source: result.source, board: result.board, company: result.company, openRoles: result.jobs.length };
}

/** Wraps a board fetch with the shared cache. Found and not-found answers are kept (asking again for a company no system
 *  has is instant); "unavailable" is not, so a system that was down is asked again next time. */
export function cachedBoards(fetchBoard: BoardGetter, cache = createCache<BoardResult>({ ttlMs: BOARD_CACHE_MS, maxEntries: BOARD_CACHE_SIZE })): BoardGetter {
  return async (source, token, label) => {
    const key = `${source}:${token}`;
    const kept = cache.get(key);
    if (kept) return kept;
    const result = await fetchBoard(source, token, label);
    if (result.kind !== "unavailable") cache.set(key, result);
    return result;
  };
}

const newestFirst = (a: Job, b: Job) => (b.postedAt ?? "").localeCompare(a.postedAt ?? "");

/** Roles whose title holds every word of the search, from every followed company, newest first. */
export async function searchCompanies(companies: Company[], query: string, getBoard: BoardGetter): Promise<SearchResult> {
  const results = await Promise.all(companies.map((c) => getBoard(c.source, c.board, c.name)));
  const jobs = results.flatMap((r) => (r.kind === "found" ? matchJobs(r.jobs, query) : [])).sort(newestFirst);
  const unavailable = companies.filter((_, i) => results[i].kind !== "found").map((c) => c.name);
  const openRoles = Object.fromEntries(companies.map((c, i) => {
    const result = results[i];
    return [companyKey(c), result.kind === "found" ? result.jobs.length : null];
  }));
  return { jobs: jobs.slice(0, MAX_RESULTS), total: jobs.length, unavailable, openRoles };
}

export interface SavedRef {
  source: Source;
  board: string;
  jobId: string;
}

/** Which saved jobs are no longer posted: their id is gone from a board that answered, or the board itself is gone.
 *  Each board is asked once. A board that didn't answer can't tell, so its jobs are "unchecked", never "closed". */
export async function closedJobs(saved: SavedRef[], getBoard: BoardGetter): Promise<{ closed: string[]; unchecked: string[] }> {
  const boards = [...new Map(saved.map((s) => [companyKey(s), s])).values()];
  const results = new Map(await Promise.all(boards.map(async (b) => [companyKey(b), await getBoard(b.source, b.board, b.board)] as const)));
  const closed: string[] = [];
  const unchecked: string[] = [];
  for (const s of saved) {
    const result = results.get(companyKey(s));
    const key = `${companyKey(s)}:${s.jobId}`;
    if (!result || result.kind === "unavailable") unchecked.push(key);
    else if (result.kind === "not-found" || !result.jobs.some((j) => j.id === s.jobId)) closed.push(key);
  }
  return { closed, unchecked };
}
