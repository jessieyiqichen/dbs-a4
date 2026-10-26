"use client";

import { updateData } from "./store";
import { putBack, takeOut, withEdit, withFreshIds, type Removed } from "./goals";
import { withPause, withoutPause } from "./progress";
import type { AppData, Entry, Goal, Settings } from "./types";
import type { GoalValues } from "./validate";

export function addEntry(goalId: string, amount: number, date: string): Entry {
  const entry: Entry = { id: crypto.randomUUID(), goalId, date, amount, at: new Date().toISOString() };
  // The session stays open while you work; Today ends it once the number is reached (or on Stop).
  updateData((data) => ({ ...data, entries: [...data.entries, entry] }));
  return entry;
}

export function removeEntry(entryId: string): void {
  updateData((data) => ({ ...data, entries: data.entries.filter((e) => e.id !== entryId) }));
}

export function markVisited(today: string): void {
  updateData((data) => (data.lastVisit === today ? data : { ...data, lastVisit: today }));
}

export function updateSettings(change: Partial<Settings>): void {
  updateData((data) => ({ ...data, settings: { ...data.settings, ...change } }));
}

export function addGoal(values: GoalValues, today: string): Goal {
  const goal: Goal = { ...values, id: crypto.randomUUID(), startDate: today, pauses: [], createdAt: new Date().toISOString() };
  updateData((data) => ({ ...data, goals: [...data.goals, goal] }));
  return goal;
}

export function updateGoal(id: string, values: GoalValues, today: string): void {
  updateData((data) => ({ ...data, goals: data.goals.map((g) => (g.id === id ? withEdit(g, values, today) : g)) }));
}

function changeGoal(id: string, change: (goal: Goal) => Goal): void {
  updateData((data) => ({ ...data, goals: data.goals.map((g) => (g.id === id ? change(g) : g)) }));
}

export function pauseGoal(id: string, days: number, today: string): void {
  changeGoal(id, (g) => withPause(g, days, today));
}

export function resumeGoal(id: string, today: string): void {
  changeGoal(id, (g) => withoutPause(g, today));
}

/** Removes a goal right away (Undo beats a confirm) and returns what was removed, for Undo. */
export function deleteGoal(id: string): Removed | null {
  let removed: Removed | null = null;
  updateData((data) => {
    const result = takeOut(data, id);
    removed = result.removed;
    return result.data;
  });
  return removed;
}

export function restoreGoal(removed: Removed): void {
  updateData((data) => putBack(data, removed));
}

/** Replaces all of this person's goals with a validated backup, under new ids (see withFreshIds). */
export function restoreData(backup: AppData): void {
  updateData(() => withFreshIds(backup));
}

/** Tapping Start: remember which goal, so coming back asks how many. */
export function startSession(goalId: string): void {
  updateData((data) => ({ ...data, session: { goalId, startedAt: new Date().toISOString() } }));
}

export function endSession(): void {
  updateData((data) => ({ ...data, session: null }));
}
