import type { Db } from "../db/remote";
import type { SearchResult } from "./service";
import { SOURCES, type Job, type Source } from "./types";

/** Searching roles through our server, and saving the ones a person wants (6c). Saved jobs go straight to Supabase from
 *  the browser, as a snapshot, so they stay readable after the posting is taken down (AGENTS.md). */

const MS_PER_DAY = 86_400_000;
/** Postgres's answer when a unique rule is broken: this job is already saved. */
const ALREADY_EXISTS = "23505";
/** The table's limits (saved_jobs check constraints). */
const LIMITS = { title: 300, company: 200, location: 500 };

type Fetcher = (url: string) => Promise<Response>;

export type SearchOutcome =
  | ({ kind: "result" } & SearchResult)
  | { kind: "refused"; message: string }
  | { kind: "failed" };

export const jobKey = (job: { source: Source; board: string; id: string }) => `${job.source}:${job.board}:${job.id}`;

const isString = (v: unknown): v is string => typeof v === "string";

function isJob(v: unknown): v is Job {
  if (typeof v !== "object" || v === null) return false;
  const j = v as Record<string, unknown>;
  return SOURCES.includes(j.source as Source) && isString(j.board) && isString(j.id) && isString(j.title) &&
    isString(j.company) && isString(j.location) && isString(j.url) && j.url.startsWith("https://") &&
    (j.postedAt === null || isString(j.postedAt));
}

/** Asks our server for matching roles. Each job is checked before it is shown; only https links are kept. */
export async function searchRoles(query: string, fetcher: Fetcher = fetch): Promise<SearchOutcome> {
  try {
    const response = await fetcher(`/api/jobs/search?${new URLSearchParams({ q: query })}`);
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (response.status === 400 && isString(body?.error)) return { kind: "refused", message: body.error };
    if (response.ok && body && Array.isArray(body.jobs) && typeof body.total === "number") {
      return {
        kind: "result",
        jobs: body.jobs.filter(isJob),
        total: body.total,
        unavailable: Array.isArray(body.unavailable) ? body.unavailable.filter(isString) : [],
        openRoles: (typeof body.openRoles === "object" && body.openRoles !== null ? body.openRoles : {}) as Record<string, number | null>,
      };
    }
    console.error("Jobs: the search answered", response.status);
  } catch (error) {
    console.error("Jobs: the search could not be reached", error);
  }
  return { kind: "failed" };
}

/** "5 days ago", or null when the board gave no date. */
export function postedAgo(postedAt: string | null, now: Date = new Date()): string | null {
  if (!postedAt) return null;
  const days = Math.floor((now.getTime() - Date.parse(postedAt)) / MS_PER_DAY);
  if (Number.isNaN(days)) return null;
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return "over a year ago";
}

/** The row saved for a job: what the saved list shows, cut to the table's limits. No user_id: the database adds it. */
export function snapshot(job: Job) {
  return {
    source: job.source,
    board_token: job.board,
    job_id: job.id,
    title: job.title.slice(0, LIMITS.title),
    company_name: job.company.slice(0, LIMITS.company),
    location: job.location ? job.location.slice(0, LIMITS.location) : null,
    url: job.url,
    posted_at: job.postedAt,
  };
}

/** Which jobs this person has saved, to show "Saved" on them in the results. */
export async function loadSavedKeys(db: Db): Promise<Set<string>> {
  const { data, error } = await db.from("saved_jobs").select("source, board_token, job_id");
  if (error) throw new Error(`Nudge: could not load saved jobs: ${error.message}`, { cause: error });
  const keys = ((data ?? []) as Record<string, unknown>[])
    .filter((r) => SOURCES.includes(r.source as Source) && isString(r.board_token) && isString(r.job_id))
    .map((r) => jobKey({ source: r.source as Source, board: r.board_token as string, id: r.job_id as string }));
  return new Set(keys);
}

/** Saves a job. Saving one that is already saved (another tab, a double tap) still counts as saved. */
export async function saveJob(db: Db, job: Job): Promise<"saved" | "failed"> {
  const { error } = await db.from("saved_jobs").insert(snapshot(job));
  if (!error || error.code === ALREADY_EXISTS) return "saved";
  console.error("Nudge: could not save a job", error);
  return "failed";
}
