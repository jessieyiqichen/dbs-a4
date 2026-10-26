import type { SupabaseClient } from "@supabase/supabase-js";
import type { Changes } from "./diff";
import { ENTRY_COLUMNS, GOAL_COLUMNS, rowToEntry, rowToGoal } from "./rows";
import type { Entry, Goal } from "../types";

export type Db = Pick<SupabaseClient, "from">;

/** Supabase answers at most 1,000 rows per request, so longer lists are read page by page. */
const PAGE = 1000;
/** Ids to delete go in the address (`id=in.(...)`); batches keep it well under the length servers accept. */
const DELETE_BATCH = 100;
const UPSERT_BATCH = 500;

class DbError extends Error {
  constructor(action: string, table: string, cause: { message: string }) {
    super(`Nudge: could not ${action} ${table}: ${cause.message}`, { cause });
  }
}

async function selectAll(db: Db, table: string, columns: string, orderBy: string[]): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = db.from(table).select(columns);
    for (const column of orderBy) query = query.order(column);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new DbError("load", table, error);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

function keepValid<T>(rows: unknown[], read: (row: unknown) => T | null, table: string): T[] {
  const kept = rows.map(read).filter((item): item is T => item !== null);
  if (kept.length < rows.length) console.error(`Nudge: skipped ${rows.length - kept.length} unreadable rows in ${table}`);
  return kept;
}

/** The signed-in person's goals and entries. Row-level security means the database only ever answers with their own
 *  rows, so there is no "where user_id = ..." here: the browser could not ask for anyone else's even if it tried. */
export async function loadRemote(db: Db): Promise<{ goals: Goal[]; entries: Entry[] }> {
  const [goalRows, entryRows] = await Promise.all([
    selectAll(db, "goals", GOAL_COLUMNS, ["position", "created_at", "id"]),
    selectAll(db, "entries", ENTRY_COLUMNS, ["at", "id"]),
  ]);
  return { goals: keepValid(goalRows, rowToGoal, "goals"), entries: keepValid(entryRows, rowToEntry, "entries") };
}

function batches<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
}

async function remove(db: Db, table: string, ids: string[]) {
  for (const batch of batches(ids, DELETE_BATCH)) {
    const { error } = await db.from(table).delete().in("id", batch);
    if (error) throw new DbError("save", table, error);
  }
}

async function upsert(db: Db, table: string, rows: object[]) {
  for (const batch of batches(rows, UPSERT_BATCH)) {
    const { error } = await db.from(table).upsert(batch);
    if (error) throw new DbError("save", table, error);
  }
}

/** Writes one change. Entries go before their goal is deleted and after their goal is added, so an entry never points
 *  at a goal that isn't there. */
export async function saveChanges(db: Db, changes: Changes): Promise<void> {
  await remove(db, "entries", changes.entryDeletes);
  await remove(db, "goals", changes.goalDeletes);
  await upsert(db, "goals", changes.goalUpserts);
  await upsert(db, "entries", changes.entryUpserts);
}
