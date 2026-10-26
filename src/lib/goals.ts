import { addDays } from "./dates";
import type { AppData, Entry, Goal } from "./types";
import type { GoalValues } from "./validate";

/** A removed goal with everything that belonged to it, kept aside so Undo can put it back. */
export interface Removed {
  goal: Goal;
  index: number;
  entries: Entry[];
}

export function takeOut(data: AppData, id: string): { data: AppData; removed: Removed } {
  const index = data.goals.findIndex((g) => g.id === id);
  const goal = data.goals[index];
  const removed = { goal, index, entries: data.entries.filter((e) => e.goalId === id) };
  return {
    data: {
      ...data,
      goals: data.goals.filter((g) => g.id !== id),
      entries: data.entries.filter((e) => e.goalId !== id),
      session: data.session?.goalId === id ? null : data.session,
    },
    removed,
  };
}

export function putBack(data: AppData, removed: Removed): AppData {
  if (data.goals.some((g) => g.id === removed.goal.id)) return data;
  const goals = [...data.goals];
  goals.splice(Math.min(removed.index, goals.length), 0, removed.goal);
  return { ...data, goals, entries: [...data.entries, ...removed.entries] };
}

/** The goal after an edit made today. When the number, the type or the date changes and the goal has days behind it,
 *  the old values are kept as applying up to yesterday, so the diary and the week's bowls judge each past day by the
 *  number it had then. A second edit the same day keeps the first record. */
export function withEdit(goal: Goal, values: GoalValues, today: string): Goal {
  const yesterday = addDays(today, -1);
  const changed = values.target !== goal.target || values.type !== goal.type || values.deadline !== goal.deadline;
  const history = goal.history ?? [];
  const recorded = history.some((h) => h.to === yesterday);
  const keep = changed && goal.startDate <= yesterday && !recorded;
  const next = keep ? [...history, { to: yesterday, target: goal.target, type: goal.type, deadline: goal.deadline }] : history;
  return { ...goal, ...values, ...(next.length > 0 ? { history: next } : {}) };
}

/** The goal as it was on a given day: the first kept record that still applied that day, or the goal as it is now. */
export function goalOn(goal: Goal, date: string): Goal {
  const past = (goal.history ?? []).find((h) => date <= h.to);
  return past ? { ...goal, target: past.target, type: past.type, deadline: past.deadline } : goal;
}

/** A backup ready to go into the database: new ids, so restoring the same file twice (or a file from someone else's
 *  account) never collides with rows that already exist, and only entries the database accepts (on a goal in the file,
 *  a whole number above 0), each goal with a real creation time. The session in progress belonged to the old ids, so it is dropped. */
export function withFreshIds(backup: AppData, newId: () => string = () => crypto.randomUUID()): AppData {
  const ids = new Map(backup.goals.map((g) => [g.id, newId()]));
  // Some older goals have an empty createdAt, which a timestamp column refuses
  const createdAt = (g: Goal) => (Number.isNaN(Date.parse(g.createdAt)) ? new Date().toISOString() : g.createdAt);
  const goals = backup.goals.map((g) => ({ ...g, id: ids.get(g.id) as string, createdAt: createdAt(g) }));
  const entries = backup.entries
    .filter((e) => ids.has(e.goalId) && Number.isInteger(e.amount) && e.amount > 0)
    .map((e) => ({ ...e, id: newId(), goalId: ids.get(e.goalId) as string }));
  return { ...backup, goals, entries, session: null };
}
