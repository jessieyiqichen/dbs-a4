import { SOURCES } from "./types";

/** The Jobs search lives in the address (teacher, 2026-10-28: after a search there was no way back): each search,
 *  company, page and the Saved tab is its own entry, so the browser's Back undoes the last one and a refresh keeps it. */
export interface SearchState {
  q: string;
  /** A followed company's key, "greenhouse:figma"; empty for all of them. */
  company: string;
  /** Counted from 0 here, from 1 in the address. */
  page: number;
  view: "search" | "saved";
}

export const MAX_QUERY = 100;
const MAX_PAGE = 500;
const COMPANY = new RegExp(`^(${SOURCES.join("|")}):[a-z0-9-]{1,64}$`);

interface Params {
  get(name: string): string | null;
}

function readPage(value: string | null): number {
  if (value === null || !/^\d{1,4}$/.test(value)) return 0;
  const page = Number(value);
  return page >= 1 && page <= MAX_PAGE ? page - 1 : 0;
}

/** What the address asks for. Anything the page itself could not have written is dropped, not trusted. */
export function readSearch(params: Params): SearchState {
  const q = (params.get("q") ?? "").trim();
  const company = params.get("company") ?? "";
  return {
    q: q.length <= MAX_QUERY ? q : "",
    company: COMPANY.test(company) ? company : "",
    page: readPage(params.get("page")),
    view: params.get("view") === "saved" ? "saved" : "search",
  };
}

/** The address for a search; plain "/jobs" when nothing is chosen. */
export function searchHref({ q, company, page, view }: SearchState): string {
  const params = new URLSearchParams();
  if (view === "saved") params.set("view", "saved");
  if (q) params.set("q", q);
  if (company) params.set("company", company);
  if (page > 0) params.set("page", String(page + 1));
  const query = params.toString();
  return query ? `/jobs?${query}` : "/jobs";
}

/** Whether anything is narrowed down, so Clear search has something to clear. */
export function isSearching({ q, company, page }: Pick<SearchState, "q" | "company" | "page">): boolean {
  return q !== "" || company !== "" || page > 0;
}
