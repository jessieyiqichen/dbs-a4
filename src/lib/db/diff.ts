import { entryToRow, goalToRow, type EntryRow, type GoalRow } from "./rows";
import type { AppData } from "../types";

/** What a change did to the goals and entries, as the writes the database needs. Settings, the session in progress and
 *  the last visit stay on this device, so they are never part of it. */
export interface Changes {
  goalUpserts: GoalRow[];
  goalDeletes: string[];
  entryUpserts: EntryRow[];
  entryDeletes: string[];
}

type Synced = Pick<AppData, "goals" | "entries">;

function changedRows<T extends { id: string }>(before: T[], after: T[]): { upserts: T[]; deletes: string[] } {
  const old = new Map(before.map((row) => [row.id, JSON.stringify(row)]));
  const kept = new Set(after.map((row) => row.id));
  return {
    upserts: after.filter((row) => old.get(row.id) !== JSON.stringify(row)),
    deletes: before.filter((row) => !kept.has(row.id)).map((row) => row.id),
  };
}

/** Compares the data before and after a change. A goal's place in the list is part of its row, so a goal that moved
 *  (Undo puts one back where it was) is sent again with its new position. */
export function diffData(before: Synced, after: Synced): Changes {
  const goals = changedRows(before.goals.map(goalToRow), after.goals.map(goalToRow));
  const entries = changedRows(before.entries.map(entryToRow), after.entries.map(entryToRow));
  return { goalUpserts: goals.upserts, goalDeletes: goals.deletes, entryUpserts: entries.upserts, entryDeletes: entries.deletes };
}

export function hasChanges(changes: Changes): boolean {
  return Object.values(changes).some((list) => list.length > 0);
}
