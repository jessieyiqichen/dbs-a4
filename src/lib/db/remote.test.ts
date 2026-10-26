import { describe, expect, it, vi } from "vitest";
import { loadRemote, saveChanges, type Db } from "./remote";
import { goalToRow, entryToRow } from "./rows";
import type { Entry, Goal } from "../types";

const goal: Goal = {
  id: "g1", verb: "Send", title: "Send cold emails", unit: "cold emails", type: "daily", target: 3, deadline: null,
  link: null, startDate: "2026-10-26", pauses: [], createdAt: "2026-10-26T15:00:00.000Z",
};
const entry: Entry = { id: "e1", goalId: "g1", date: "2026-10-26", amount: 1, at: "2026-10-26T16:00:00.000Z" };

type Answer = { data: unknown[] | null; error: { message: string } | null };

/** A stand-in for the Supabase client: records every call and answers from `tables`, so no request leaves the test. */
function fakeDb(tables: Record<string, unknown[]>, fail: string | null = null) {
  const calls: string[] = [];
  const answer = (table: string, data: unknown[] | null): Answer =>
    fail === table ? { data: null, error: { message: "network down" } } : { data, error: null };
  const db = {
    from(table: string) {
      return {
        select(columns: string) {
          calls.push(`select ${table} ${columns.split(",").length} columns`);
          const query = {
            order: () => query,
            range: async (from: number, to: number) => answer(table, (tables[table] ?? []).slice(from, to + 1)),
          };
          return query;
        },
        delete: () => ({ in: async (_: string, ids: string[]) => { calls.push(`delete ${table} ${ids.join(",")}`); return answer(table, null); } }),
        upsert: async (rows: { id: string }[]) => { calls.push(`upsert ${table} ${rows.map((r) => r.id).join(",")}`); return answer(table, null); },
      };
    },
  };
  return { db: db as unknown as Db, calls };
}

describe("loadRemote", () => {
  it("reads goals and entries from their rows", async () => {
    const { db } = fakeDb({ goals: [goalToRow(goal, 0)], entries: [entryToRow(entry)] });
    expect(await loadRemote(db)).toEqual({ goals: [goal], entries: [entry] });
  });

  it("skips a row with the wrong shape and says so in the console", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = fakeDb({ goals: [goalToRow(goal, 0), { id: "bad" }], entries: [] });
    expect((await loadRemote(db)).goals).toEqual([goal]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("reads past the first 1,000 entries", async () => {
    const many = Array.from({ length: 1500 }, (_, i) => entryToRow({ ...entry, id: `e${i}` }));
    const { db } = fakeDb({ goals: [goalToRow(goal, 0)], entries: many });
    expect((await loadRemote(db)).entries).toHaveLength(1500);
  });

  it("fails loudly when the database can't be reached", async () => {
    const { db } = fakeDb({ goals: [] }, "goals");
    await expect(loadRemote(db)).rejects.toThrow("Nudge: could not load goals: network down");
  });
});

describe("saveChanges", () => {
  it("removes entries and goals before adding, and adds goals before their entries", async () => {
    const { db, calls } = fakeDb({});
    await saveChanges(db, {
      goalUpserts: [goalToRow(goal, 0)], goalDeletes: ["g0"], entryUpserts: [entryToRow(entry)], entryDeletes: ["e0"],
    });
    expect(calls).toEqual(["delete entries e0", "delete goals g0", "upsert goals g1", "upsert entries e1"]);
  });

  it("does nothing for an empty change", async () => {
    const { db, calls } = fakeDb({});
    await saveChanges(db, { goalUpserts: [], goalDeletes: [], entryUpserts: [], entryDeletes: [] });
    expect(calls).toEqual([]);
  });

  it("deletes many rows in batches, so the address stays short", async () => {
    const { db, calls } = fakeDb({});
    const ids = Array.from({ length: 250 }, (_, i) => `e${i}`);
    await saveChanges(db, { goalUpserts: [], goalDeletes: [], entryUpserts: [], entryDeletes: ids });
    expect(calls).toHaveLength(3);
  });

  it("stops at the first write that fails", async () => {
    const { db, calls } = fakeDb({}, "goals");
    await expect(
      saveChanges(db, { goalUpserts: [goalToRow(goal, 0)], goalDeletes: [], entryUpserts: [entryToRow(entry)], entryDeletes: [] }),
    ).rejects.toThrow("Nudge: could not save goals: network down");
    expect(calls).toEqual(["upsert goals g1"]);
  });
});
