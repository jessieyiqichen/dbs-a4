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

/** Asks our server for matching roles, at every followed company or the chosen one ("source:board"). Each job is
 *  checked before it is shown; only https links are kept. */
export async function searchRoles(query: string, fetcher: Fetcher = fetch, company = ""): Promise<SearchOutcome> {
  try {
    const params = new URLSearchParams({ q: query, ...(company ? { company } : {}) });
    const response = await fetcher(`/api/jobs/search?${params}`);
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

export interface SavedJob {
  id: string;
  source: Source;
  board: string;
  jobId: string;
  title: string;
  company: string;
  location: string;
  url: string;
  postedAt: string | null;
  status: "saved" | "applied";
  savedAt: string;
  appliedAt: string | null;
}

const SAVED_COLUMNS = "id, source, board_token, job_id, title, company_name, location, url, posted_at, status, saved_at, applied_at";

/** The same key as the job it came from, so the search can show "Saved" on it. */
export const savedKey = (saved: SavedJob) => `${saved.source}:${saved.board}:${saved.jobId}`;

function toISO(v: unknown): string | null {
  const time = isString(v) ? Date.parse(v) : NaN;
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

export function rowToSaved(row: unknown): SavedJob | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  const savedAt = toISO(r.saved_at);
  const valid = isString(r.id) && SOURCES.includes(r.source as Source) && isString(r.board_token) && isString(r.job_id) &&
    isString(r.title) && isString(r.company_name) && isString(r.url) && r.url.startsWith("https://") &&
    (r.status === "saved" || r.status === "applied") && savedAt !== null;
  if (!valid) return null;
  return {
    id: r.id as string, source: r.source as Source, board: r.board_token as string, jobId: r.job_id as string,
    title: r.title as string, company: r.company_name as string, location: isString(r.location) ? r.location : "",
    url: r.url as string, postedAt: toISO(r.posted_at), status: r.status as SavedJob["status"], savedAt, appliedAt: toISO(r.applied_at),
  };
}

/** This person's saved jobs, newest first. */
export async function loadSaved(db: Db): Promise<SavedJob[]> {
  const { data, error } = await db.from("saved_jobs").select(SAVED_COLUMNS).order("saved_at", { ascending: false });
  if (error) throw new Error(`Nudge: could not load saved jobs: ${error.message}`, { cause: error });
  const rows = (data ?? []) as unknown[];
  const kept = rows.map(rowToSaved).filter((s): s is SavedJob => s !== null);
  if (kept.length < rows.length) console.error(`Nudge: skipped ${rows.length - kept.length} unreadable saved jobs`);
  return kept;
}

export type SaveResult = { kind: "saved"; saved: SavedJob } | { kind: "already" } | { kind: "failed" };

/** Saves a job and hands back the saved row. Already saved (another tab, a double tap) is told apart from a failure. */
export async function saveJob(db: Db, job: Job): Promise<SaveResult> {
  const { data, error } = await db.from("saved_jobs").insert(snapshot(job)).select(SAVED_COLUMNS).single();
  if (error?.code === ALREADY_EXISTS) return { kind: "already" };
  const saved = error ? null : rowToSaved(data);
  if (saved) return { kind: "saved", saved };
  console.error("Nudge: could not save a job", error);
  return { kind: "failed" };
}

/** Applied at a time, or back to saved with null. */
export async function setApplied(db: Db, id: string, appliedAt: string | null): Promise<boolean> {
  const { error } = await db.from("saved_jobs").update({ status: appliedAt ? "applied" : "saved", applied_at: appliedAt }).eq("id", id);
  if (error) console.error("Nudge: could not change a saved job", error);
  return !error;
}

export async function removeSaved(db: Db, id: string): Promise<boolean> {
  const { error } = await db.from("saved_jobs").delete().eq("id", id);
  if (error) console.error("Nudge: could not remove a saved job", error);
  return !error;
}

/** Undo: the same row back, with its id, status and times. */
export async function restoreSaved(db: Db, saved: SavedJob): Promise<boolean> {
  const { error } = await db.from("saved_jobs").insert({
    id: saved.id, source: saved.source, board_token: saved.board, job_id: saved.jobId, title: saved.title,
    company_name: saved.company, location: saved.location || null, url: saved.url, posted_at: saved.postedAt,
    status: saved.status, saved_at: saved.savedAt, applied_at: saved.appliedAt,
  });
  if (error) console.error("Nudge: could not put a saved job back", error);
  return !error;
}
