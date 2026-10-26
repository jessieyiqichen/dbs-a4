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
  saveFailed: "That didn't save, check your connection and try again",
  loadFailed: { title: "Your companies didn't load", next: "Check your connection, then try again" },
  rolesUnknown: "didn't answer just now",
  searchNext: "Searching their roles comes next",
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
