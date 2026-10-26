import { SOURCE_NAMES } from "./companies";
import type { Source } from "./types";

/** What the Jobs page says (6b, agreed 2026-10-26). House style: no full stops, errors without "!" (copy.test.ts). */
export const JOBS_COPY = {
  title: "Your companies",
  intro: "Add the ones you're aiming for, I'll find their open roles",
  emptyBubble: "Which companies are you aiming for? I'll fetch their open roles!",
  suggestedLabel: "Tap one to add it, or find your own below",
  addLabel: "Add a company",
  addPlaceholder: "Company name, like Stripe",
  find: "Find",
  looking: "Looking…",
  checking: "Checking Greenhouse, Ashby and Lever",
  emptyName: "Enter a company name, like Stripe",
  notFound: "Couldn't find this company on Greenhouse, Ashby or Lever",
  linkLabel: "Have a job link from them? Paste it",
  linkPlaceholder: "https://jobs.lever.co/…",
  emptyLink: "Paste a job link, like jobs.lever.co/spotify",
  unavailable: "A hiring system didn't answer, try again in a minute",
  tooMany: "Too many searches at once, wait a minute and try again",
  limit: "You follow 25 companies, remove one to add another",
  saveFailed: "That didn't save, check your connection and try again",
  loadFailed: { title: "Your companies didn't load", next: "Check your connection, then try again" },
  rolesUnknown: "didn't answer just now",
};

export const rolesCount = (n: number) => (n === 1 ? "1 open role" : `${n} open roles`);

export function foundLine(name: string, source: Source, openRoles: number): string {
  const where = `Found ${name} on ${SOURCE_NAMES[source]}`;
  return openRoles === 0 ? `${where}, no open roles right now` : `${where}, ${rolesCount(openRoles)}`;
}

export const addLabel = (name: string) => `Add ${name}`;
export const addedLine = (name: string) => `Added ${name}!`;
export const removedLine = (name: string) => `Removed ${name}`;
export const alreadyLine = (name: string) => `You already follow ${name}`;

/** 6c: searching the followed companies' roles and saving them (agreed 2026-10-26). */
export const SEARCH_COPY = {
  label: "Job title",
  companyLabel: "Company",
  addOption: "+ Add a company…",
  manageOption: "Manage companies…",
  manageTitle: "Your companies",
  done: "Done",
  placeholder: "Job title, like product manager",
  search: "Search",
  save: "Save",
  saved: "Saved ✓",
  saving: "Saving…",
  view: "View posting ↗",
  newTab: "(opens in a new tab)",
  allDown: "The hiring systems didn't answer, try again in a minute",
  tryAgain: "Try again",
};

/** "Anthropic, Figma and Notion", or "your 5 companies" when the list would be long. */
export function companyList(names: string[]): string {
  if (names.length > 3) return `your ${names.length} companies`;
  if (names.length <= 1) return names[0] ?? "your companies";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export const lookingLine = (names: string[]) => `Looking through ${companyList(names)}…`;

export function resultsLine(total: number, query: string, names: string[]): string {
  const roles = total === 1 ? "1 role" : `${total} roles`;
  return query ? `${roles} match "${query}" at ${companyList(names)}` : `${roles} at ${companyList(names)}, newest first`;
}

/** The company menu (Jobs search, user 2026-10-26): all of them, each one with its open roles, then add and manage. */
export const allCompaniesOption = (count: number) => `All my companies (${count})`;
export function companyOption(name: string, openRoles: number | null | undefined): string {
  if (openRoles === undefined) return name;
  return `${name} · ${openRoles === null ? JOBS_COPY.rolesUnknown : rolesCount(openRoles)}`;
}

export const moreLine = (shown: number, total: number) => `Showing the newest ${shown} of ${total}, add a word to narrow it`;
export const noMatchLine = (query: string) => `No roles match "${query}" at your companies right now, try a shorter title like "designer"`;
export const someDownLine = (names: string[]) => `${companyList(names)} didn't answer, showing the rest`;

/** 6d: the saved list on Jobs, and saved jobs on the applications goal's page (agreed 2026-10-26). */
export const SAVED_COPY = {
  tabSearch: "Search",
  tabSaved: "Saved",
  empty: "Save a role from the search and it'll wait here for you",
  iApplied: "I applied",
  applied: "Applied ✓",
  apply: "Apply ↗",
  closed: "No longer posted",
  remove: "Remove",
  countToward: "Count this toward",
  countIt: "Count it",
  notNow: "Not now",
  noGoal: "Applied! Set an applications goal to count these for Titi",
  backToSaved: "Back to saved, and its fish went back too",
  loadFailed: { title: "Your saved jobs didn't load", next: "Check your connection, then try again" },
  sessionHeading: "Your saved jobs",
  findMore: "Need roles to apply to? Find some on Jobs",
};

export const savedTab = (count: number) => `Saved ${count}`;
export const savedWhen = (status: "saved" | "applied", ago: string | null) => (ago ? `${status} ${ago}` : status);
export const addedToGoal = (goalTitle: string) => `Added 1 to "${goalTitle}"! One more fish for Titi`;
