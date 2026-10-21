import type { Board, Job, Source } from "./types";

type Raw = Record<string, unknown>;

function isObject(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toIso(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Only https links reach the page, so a board can never hand us a javascript: link. */
function safeUrl(value: unknown): string | null {
  const url = text(value);
  return url.startsWith("https://") ? url : null;
}

function joinLocations(values: unknown[]): string {
  const names = values.map(text).filter((name) => name !== "");
  return [...new Set(names)].join(" | ");
}

interface Fields {
  id: unknown;
  title: unknown;
  url: unknown;
  location: string;
  postedAt: unknown;
}

/** A job from one board's raw fields, or null when it has no id, title or safe link. */
function toJob(source: Source, board: string, company: string, fields: Fields): Job | null {
  const id = typeof fields.id === "number" ? String(fields.id) : text(fields.id);
  const title = text(fields.title);
  const url = safeUrl(fields.url);
  if (id === "" || title === "" || url === null) return null;
  return { source, board, id, title, company, location: fields.location, url, postedAt: toIso(fields.postedAt) };
}

function keep(jobs: (Job | null)[]): Job[] {
  return jobs.filter((job): job is Job => job !== null);
}

/** Greenhouse: `{ jobs: [...] }`; the company name is on every job. */
export function fromGreenhouse(raw: unknown, board: string): Board | null {
  if (!isObject(raw) || !Array.isArray(raw.jobs)) return null;
  const items = raw.jobs.filter(isObject);
  const company = text(items[0]?.company_name) || board;
  const jobs = items.map((item) =>
    toJob("greenhouse", board, company, {
      id: item.id,
      title: item.title,
      url: item.absolute_url,
      location: isObject(item.location) ? text(item.location.name) : "",
      postedAt: item.first_published,
    }),
  );
  return { company, jobs: keep(jobs) };
}

/** Ashby: `{ jobs: [...] }`; no company name in the response, so the caller passes one. */
export function fromAshby(raw: unknown, board: string, company: string): Board | null {
  if (!isObject(raw) || !Array.isArray(raw.jobs)) return null;
  const listed = raw.jobs.filter(isObject).filter((item) => item.isListed !== false);
  const jobs = listed.map((item) => {
    const secondary = Array.isArray(item.secondaryLocations) ? item.secondaryLocations : [];
    const others = secondary.map((s) => (isObject(s) ? s.location : null));
    return toJob("ashby", board, company, {
      id: item.id,
      title: item.title,
      url: item.jobUrl,
      location: joinLocations([item.location, ...others]),
      postedAt: item.publishedAt,
    });
  });
  return { company, jobs: keep(jobs) };
}

/** Lever: a bare array of postings (a not-found board answers `{ ok: false }`); no company name either. */
export function fromLever(raw: unknown, board: string, company: string): Board | null {
  if (!Array.isArray(raw)) return null;
  const jobs = raw.filter(isObject).map((item) => {
    const categories = isObject(item.categories) ? item.categories : {};
    const all = Array.isArray(categories.allLocations) ? categories.allLocations : [];
    return toJob("lever", board, company, {
      id: item.id,
      title: item.text,
      url: item.hostedUrl,
      location: joinLocations(all.length > 0 ? all : [categories.location]),
      postedAt: item.createdAt,
    });
  });
  return { company, jobs: keep(jobs) };
}
