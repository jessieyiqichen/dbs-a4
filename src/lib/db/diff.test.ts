import { describe, expect, it } from "vitest";
import { hasChanges, diffData } from "./diff";
import { putBack, takeOut } from "../goals";
import { emptyData } from "../storage";
import type { AppData, Entry, Goal } from "../types";

const goal = (id: string): Goal => ({
  id, verb: "Send", title: "Send cold emails", unit: "cold emails", type: "daily", target: 3, deadline: null, link: null,
  startDate: "2026-10-26", pauses: [], createdAt: "2026-10-26T15:00:00.000Z",
});
const entry = (id: string, goalId: string): Entry => ({ id, goalId, date: "2026-10-26", amount: 1, at: "2026-10-26T16:00:00.000Z" });

const base: AppData = { ...emptyData(), goals: [goal("a"), goal("b")], entries: [entry("e1", "a"), entry("e2", "b")] };

describe("diffData", () => {
  it("finds nothing when only device settings changed", () => {
    const next = { ...base, lastVisit: "2026-10-26", session: { goalId: "a", startedAt: "2026-10-26T16:00:00.000Z" } };
    expect(hasChanges(diffData(base, next))).toBe(false);
  });

  it("sends a new goal at the end of the list", () => {
    const changes = diffData(base, { ...base, goals: [...base.goals, goal("c")] });
    expect(changes.goalUpserts.map((r) => [r.id, r.position])).toEqual([["c", 2]]);
    expect(changes.goalDeletes).toEqual([]);
  });

  it("sends only the goal that was edited", () => {
    const next = { ...base, goals: base.goals.map((g) => (g.id === "b" ? { ...g, target: 5 } : g)) };
    expect(diffData(base, next).goalUpserts.map((r) => r.id)).toEqual(["b"]);
  });

  it("sends a new entry, and a removed one as a delete", () => {
    expect(diffData(base, { ...base, entries: [...base.entries, entry("e3", "a")] }).entryUpserts.map((r) => r.id)).toEqual(["e3"]);
    expect(diffData(base, { ...base, entries: [entry("e1", "a")] }).entryDeletes).toEqual(["e2"]);
  });

  it("deletes a removed goal with its entries, and Undo puts both back in the same place", () => {
    const { data: removed, removed: kept } = takeOut(base, "a");
    const out = diffData(base, removed);
    expect(out.goalDeletes).toEqual(["a"]);
    expect(out.entryDeletes).toEqual(["e1"]);
    // "b" moved up to the first place
    expect(out.goalUpserts.map((r) => [r.id, r.position])).toEqual([["b", 0]]);

    const back = diffData(removed, putBack(removed, kept));
    expect(back.goalUpserts.map((r) => [r.id, r.position])).toEqual([["a", 0], ["b", 1]]);
    expect(back.entryUpserts.map((r) => r.id)).toEqual(["e1"]);
  });
});
