/** The hiring systems whose public job boards we read. None of them needs a key. */
export type Source = "greenhouse" | "ashby" | "lever";

/** The order a company name is tried in: Greenhouse has the most companies, Lever the fewest. */
export const SOURCES: readonly Source[] = ["greenhouse", "ashby", "lever"];

/** One open role, trimmed to what the pages use. The raw boards also carry full descriptions (up to 13 MB a board). */
export interface Job {
  source: Source;
  /** The company's board name on that system, e.g. "figma". */
  board: string;
  /** Greenhouse ids are numbers, Ashby and Lever ids are uuids: kept as text for all three. */
  id: string;
  title: string;
  company: string;
  /** Every location joined with " | ", or empty when the board gives none. */
  location: string;
  /** The posting on the hiring system's own site, where people apply. Always https. */
  url: string;
  /** ISO time the job was first published, or null when the board does not say. */
  postedAt: string | null;
}

export interface Board {
  company: string;
  jobs: Job[];
}

export type BoardResult =
  | ({ kind: "found"; source: Source; board: string } & Board)
  | { kind: "not-found" }
  | { kind: "unavailable" };

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
