import { daysBetween } from "./dates";
import { formatCount } from "./format";
import type { GoalType } from "./types";


export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export const MAX_LOG = 1000;

/** A count typed by the person, e.g. "8" in "Log several". */
/** What is wrong with a count, if anything: not a whole number, or 0 (a whole number, but nothing to count; the first
 *  version said "Enter a whole number" for 0 too, which was not true, first-run check 2). */
export function countError(text: string, example: number): string | undefined {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return `Enter a whole number, like ${example}`;
  if (Number(trimmed) < 1) return `Enter a number above 0, like ${example}`;
}

export function parseCount(text: string): Parsed<number> {
  const trimmed = text.trim();
  const error = countError(trimmed, 5);
  if (error) return { ok: false, error };
  const value = Number(trimmed);
  if (value > MAX_LOG) return { ok: false, error: "That's a lot! Enter a number up to 1,000" };
  return { ok: true, value };
}

/** "HH:MM" from a time field. */
export function parseTime(text: string): Parsed<string> {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text.trim())
    ? { ok: true, value: text.trim() }
    : { ok: false, error: "Enter a time, like 20:00" };
}

export const MAX_WORDS = 40;
export const MAX_TARGET = 100_000;
export const HIGH_PACE = 50;
export const DEFAULT_UNIT = "times";

export interface GoalDraft {
  verb: string;
  type: GoalType;
  target: string;
  unit: string;
  deadline: string;
  link: string;
}

export type GoalField = keyof GoalDraft;

export interface GoalValues {
  verb: string;
  title: string;
  type: GoalType;
  target: number;
  unit: string;
  deadline: string | null;
  link: string | null;
}

export interface GoalValidation {
  errors: Partial<Record<GoalField, string>>;
  value: GoalValues | null;
}

function checkVerb(text: string): string | undefined {
  if (text.length === 0) return 'Enter what you\'ll do, like "Send" or "Practice"';
  if (text.length > MAX_WORDS) return "Keep it under 40 characters";
}

function checkUnit(text: string): string | undefined {
  if (text.length > MAX_WORDS) return "Keep it under 40 characters";
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function checkTarget(text: string, type: GoalType = "by-date"): string | undefined {
  const error = countError(text, type === "daily" ? 3 : 100);
  if (error) return error;
  if (Number(text) > MAX_TARGET) return "Enter a number up to 100,000";
}

function checkDeadline(type: GoalType, text: string, today: string): string | undefined {
  if (type !== "by-date") return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "Pick the date you want to finish by";
  if (text <= today) return "Pick a date after today";
}

/** The link if it is a web address (http or https), else null: goals read from the database or a backup file pass
 *  through this, so a "javascript:" link can never reach the Open button (security review, 2026-10-26). */
export function webLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

/** "" is fine (no page to open); otherwise it must be a full http(s) link. */
export function linkError(text: string): string | undefined {
  if (text.length === 0) return;
  try {
    const url = new URL(text);
    if (url.protocol === "https:" || url.protocol === "http:") return;
  } catch {
    // fall through to the error below
  }
  return "Paste a full link that starts with https://";
}

/** Checks the goal form. Errors say what to do next; the draft is never changed. */
export function validateGoal(draft: GoalDraft, today: string): GoalValidation {
  const verb = capitalize(draft.verb.trim().toLowerCase());
  const unit = draft.unit.trim().toLowerCase() || DEFAULT_UNIT;
  const target = draft.target.trim();
  const link = draft.link.trim();
  const errors: GoalValidation["errors"] = {};
  const found: [GoalField, string | undefined][] = [
    ["verb", checkVerb(verb)],
    ["unit", checkUnit(unit)],
    ["target", checkTarget(target, draft.type)],
    ["deadline", checkDeadline(draft.type, draft.deadline, today)],
    ["link", linkError(link)],
  ];
  for (const [field, error] of found) if (error) errors[field] = error;
  if (Object.keys(errors).length > 0) return { errors, value: null };

  return {
    errors,
    value: {
      verb,
      unit,
      title: `${verb} ${unit}`,
      type: draft.type,
      target: Number(target),
      deadline: draft.type === "by-date" ? draft.deadline : null,
      link: link || null,
    },
  };
}

/** The live "That's about 11 a day" line under a by-date goal's numbers. */
export function dailyPreview(target: string, deadline: string, unit: string, today: string) {
  if (checkTarget(target.trim()) || checkDeadline("by-date", deadline, today)) return null;
  const perDay = Math.ceil(Number(target) / (daysBetween(today, deadline) + 1));
  const what = unit.trim().toLowerCase() || DEFAULT_UNIT;
  const message =
    perDay > HIGH_PACE
      ? `That's ${perDay} ${what} a day, that's a lot! Pick a later date or a smaller number?`
      : `That's about ${formatCount(perDay, what)} a day!`;
  return { perDay, message };
}
