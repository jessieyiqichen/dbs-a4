import { isGoalPast } from "../storage";
import type { Entry, Goal } from "../types";

/** A goal as the `goals` table stores it. No user_id: the database fills it in from the signed-in person's token. */
export interface GoalRow {
  id: string;
  verb: string;
  title: string;
  unit: string;
  type: Goal["type"];
  target: number;
  deadline: string | null;
  link: string | null;
  start_date: string;
  pauses: Goal["pauses"];
  history: NonNullable<Goal["history"]>;
  position: number;
  created_at: string;
}

export interface EntryRow {
  id: string;
  goal_id: string;
  date: string;
  amount: number;
  at: string;
}

export const GOAL_COLUMNS = "id, verb, title, unit, type, target, deadline, link, start_date, pauses, history, position, created_at";
export const ENTRY_COLUMNS = "id, goal_id, date, amount, at";

export function goalToRow(goal: Goal, position: number): GoalRow {
  return {
    id: goal.id,
    verb: goal.verb,
    title: goal.title,
    unit: goal.unit,
    type: goal.type,
    target: goal.target,
    deadline: goal.deadline,
    link: goal.link,
    start_date: goal.startDate,
    pauses: goal.pauses,
    history: goal.history ?? [],
    position,
    created_at: goal.createdAt,
  };
}

export function entryToRow(entry: Entry): EntryRow {
  return { id: entry.id, goal_id: entry.goalId, date: entry.date, amount: entry.amount, at: entry.at };
}

const isString = (v: unknown): v is string => typeof v === "string";
const isNullableString = (v: unknown): v is string | null => v === null || isString(v);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isDay = (v: unknown): v is string => isString(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

/** Postgres answers "2026-10-26T15:00:00+00:00"; the app writes and compares toISOString() ("...00.000Z"). */
function toISO(v: unknown): string | null {
  if (!isString(v)) return null;
  const time = Date.parse(v);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** A row from the database as a goal, or null if its shape is wrong: data from outside is checked before use. */
export function rowToGoal(row: unknown): Goal | null {
  if (!isRecord(row)) return null;
  const { id, verb, title, unit, type, target, deadline, link, start_date, pauses, history } = row;
  const createdAt = toISO(row.created_at);
  const valid =
    isString(id) && isString(verb) && isString(title) && isString(unit) &&
    (type === "by-date" || type === "daily") && isCount(target) &&
    (deadline === null || isDay(deadline)) && isNullableString(link) && isDay(start_date) && createdAt !== null &&
    Array.isArray(pauses) && pauses.every((p) => isRecord(p) && isDay(p.from) && isDay(p.to));
  if (!valid) return null;
  const kept = Array.isArray(history) ? history.filter(isGoalPast) : [];
  return {
    id, verb, title, unit, type, target, deadline, link,
    startDate: start_date,
    pauses: pauses.map((p) => ({ from: p.from, to: p.to })),
    createdAt,
    ...(kept.length > 0 ? { history: kept } : {}),
  };
}

export function rowToEntry(row: unknown): Entry | null {
  if (!isRecord(row)) return null;
  const { id, goal_id, date, amount } = row;
  const at = toISO(row.at);
  if (!isString(id) || !isString(goal_id) || !isDay(date) || !isCount(amount) || at === null) return null;
  return { id, goalId: goal_id, date, amount, at };
}
