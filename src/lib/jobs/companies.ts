import type { Db } from "../db/remote";
import { SOURCES, type Source } from "./types";
import type { Company, CompanySummary } from "./service";

/** The companies a person follows, as the browser reads and writes them. Rows go straight to Supabase from the browser
 *  (row-level security keeps each person to their own); looking a company up goes through our server route. */

export interface FollowedCompany extends Company {
  id: string;
  addedAt: string;
}

/** One-tap choices for an empty list (AGENTS.md: a constant, nothing written until the person adds one). All eight
 *  were found live on 2026-10-26, across the three systems. */
export const SUGGESTED: readonly Company[] = [
  { source: "greenhouse", board: "anthropic", name: "Anthropic" },
  { source: "greenhouse", board: "airbnb", name: "Airbnb" },
  { source: "greenhouse", board: "figma", name: "Figma" },
  { source: "ashby", board: "openai", name: "OpenAI" },
  { source: "ashby", board: "notion", name: "Notion" },
  { source: "ashby", board: "perplexity", name: "Perplexity" },
  { source: "lever", board: "spotify", name: "Spotify" },
  { source: "lever", board: "palantir", name: "Palantir" },
];

export const SOURCE_NAMES: Record<Source, string> = { greenhouse: "Greenhouse", ashby: "Ashby", lever: "Lever" };

const TOKEN = /^[a-z0-9-]{1,64}$/;
const COLUMNS = "id, source, board_token, name, added_at";
/** Postgres's answer when a unique rule is broken: here, the same company followed twice. */
const ALREADY_EXISTS = "23505";

type Fetcher = (url: string) => Promise<Response>;

export function rowToFollowed(row: unknown): FollowedCompany | null {
  if (typeof row !== "object" || row === null) return null;
  const { id, source, board_token, name, added_at } = row as Record<string, unknown>;
  const addedAt = typeof added_at === "string" ? Date.parse(added_at) : NaN;
  const valid = typeof id === "string" && SOURCES.includes(source as Source) && typeof board_token === "string" &&
    TOKEN.test(board_token) && typeof name === "string" && name.length > 0 && !Number.isNaN(addedAt);
  return valid ? { id, source: source as Source, board: board_token, name, addedAt: new Date(addedAt).toISOString() } : null;
}

function isSummary(value: unknown): value is CompanySummary {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.kind === "not-found" || v.kind === "unavailable") return true;
  return v.kind === "found" && SOURCES.includes(v.source as Source) && typeof v.board === "string" && TOKEN.test(v.board) &&
    typeof v.company === "string" && typeof v.openRoles === "number";
}

/** Asks our server to find a company on Greenhouse, Ashby or Lever. Anything unexpected counts as unavailable, so the
 *  page says "try again" rather than "not found" when it simply couldn't tell. */
export async function lookupCompany(name: string, fetcher: Fetcher = fetch): Promise<CompanySummary> {
  try {
    const response = await fetcher(`/api/jobs/company?${new URLSearchParams({ name })}`);
    const body: unknown = response.ok ? await response.json() : null;
    if (isSummary(body)) return body;
    console.error("Jobs: the company lookup answered", response.status);
  } catch (error) {
    console.error("Jobs: the company lookup could not be reached", error);
  }
  return { kind: "unavailable" };
}

export async function loadFollowed(db: Db): Promise<FollowedCompany[]> {
  const { data, error } = await db.from("companies").select(COLUMNS).order("added_at");
  if (error) throw new Error(`Nudge: could not load companies: ${error.message}`, { cause: error });
  const rows = (data ?? []) as unknown[];
  const kept = rows.map(rowToFollowed).filter((c): c is FollowedCompany => c !== null);
  if (kept.length < rows.length) console.error(`Nudge: skipped ${rows.length - kept.length} unreadable companies`);
  return kept;
}

export type FollowResult = { kind: "followed"; company: FollowedCompany } | { kind: "already" } | { kind: "failed" };

/** Follows a company. No user_id is sent: the database fills it in from the signed-in person's token. */
export async function follow(db: Db, company: Company): Promise<FollowResult> {
  const { data, error } = await db.from("companies")
    .insert({ source: company.source, board_token: company.board, name: company.name })
    .select(COLUMNS).single();
  if (error?.code === ALREADY_EXISTS) return { kind: "already" };
  const followed = error ? null : rowToFollowed(data);
  if (followed) return { kind: "followed", company: followed };
  console.error("Nudge: could not follow a company", error);
  return { kind: "failed" };
}

export async function unfollow(db: Db, id: string): Promise<boolean> {
  const { error } = await db.from("companies").delete().eq("id", id);
  if (error) console.error("Nudge: could not remove a company", error);
  return !error;
}

/** Undo: the same row back, with its id and the time it was first added, so the list keeps its order. */
export async function refollow(db: Db, company: FollowedCompany): Promise<boolean> {
  const { error } = await db.from("companies").insert({
    id: company.id, source: company.source, board_token: company.board, name: company.name, added_at: company.addedAt,
  });
  if (error) console.error("Nudge: could not put a company back", error);
  return !error;
}
