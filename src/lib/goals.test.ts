import { describe, expect, it } from "vitest";
import { goalOn, putBack, takeOut, withEdit, withFreshIds } from "./goals";
import { emptyData } from "./storage";
import type { Entry, Goal } from "./types";

const g1: Goal = { id: "g1", verb: "Send", title: "Send applications", unit: "applications", type: "daily", target: 2, deadline: null, link: null, startDate: "2026-10-05", pauses: [], createdAt: "" };
const g2: Goal = { ...g1, id: "g2" };
const e = (goalId: string, id: string): Entry => ({ id, goalId, date: "2026-10-17", amount: 1, at: "" });

describe("removing a goal and putting it back (Undo)", () => {
  const data = { ...emptyData(), goals: [g1, g2], entries: [e("g1", "a"), e("g2", "b"), e("g1", "c")], session: { goalId: "g1", startedAt: "" } };

  it("takes the goal, its entries and its session out, and hands them back for Undo", () => {
    const { data: rest, removed } = takeOut(data, "g1");
    expect(rest.goals.map((g) => g.id)).toEqual(["g2"]);
    expect(rest.entries.map((x) => x.id)).toEqual(["b"]);
    expect(rest.session).toBeNull();
    expect(removed.goal.id).toBe("g1");
    expect(removed.entries.map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("puts everything back, in its old place", () => {
    const { data: rest, removed } = takeOut(data, "g1");
    const back = putBack(rest, removed);
    expect(back.goals.map((g) => g.id)).toEqual(["g1", "g2"]);
    expect(back.entries.map((x) => x.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("does not add a second copy if Undo is pressed twice", () => {
    const { data: rest, removed } = takeOut(data, "g1");
    const twice = putBack(putBack(rest, removed), removed);
    expect(twice.goals.filter((g) => g.id === "g1")).toHaveLength(1);
  });
});

describe("editing a goal keeps its past: each day is judged by the number it had then", () => {
  const daily: Goal = { id: "d", verb: "Send", title: "Send applications", unit: "applications", type: "daily", target: 2, deadline: null, link: null, startDate: "2026-10-12", pauses: [], createdAt: "" };
  const values = { verb: "Send", title: "Send applications", unit: "applications", type: "daily" as const, target: 3, deadline: null, link: null };

  it("records the old number up to yesterday when the number changes, and today uses the new one", () => {
    const edited = withEdit(daily, values, "2026-10-19");
    expect(edited.target).toBe(3);
    expect(edited.history).toEqual([{ to: "2026-10-18", target: 2, type: "daily", deadline: null }]);
    expect(goalOn(edited, "2026-10-14").target).toBe(2);
    expect(goalOn(edited, "2026-10-18").target).toBe(2);
    expect(goalOn(edited, "2026-10-19").target).toBe(3);
  });

  it("keeps the first record when edited again the same day, and adds nothing when the number stays", () => {
    const twice = withEdit(withEdit(daily, values, "2026-10-19"), { ...values, target: 4 }, "2026-10-19");
    expect(twice.history).toEqual([{ to: "2026-10-18", target: 2, type: "daily", deadline: null }]);
    expect(twice.target).toBe(4);
    expect(withEdit(daily, { ...values, target: 2, unit: "job applications" }, "2026-10-19").history ?? []).toEqual([]);
  });

  it("has no past to keep for a goal that started today", () => {
    expect(withEdit({ ...daily, startDate: "2026-10-19" }, values, "2026-10-19").history ?? []).toEqual([]);
  });
});

describe("withFreshIds", () => {
  const goal = { id: "old-goal", verb: "Send", title: "Send cold emails", unit: "cold emails", type: "daily" as const, target: 3, deadline: null, link: null, startDate: "2026-10-12", pauses: [], createdAt: "2026-10-12T10:00:00.000Z" };
  const backup = {
    ...emptyData(),
    goals: [goal],
    entries: [
      { id: "old-entry", goalId: "old-goal", date: "2026-10-12", amount: 2, at: "2026-10-12T11:00:00.000Z" },
      { id: "orphan", goalId: "gone", date: "2026-10-12", amount: 1, at: "2026-10-12T11:00:00.000Z" },
      { id: "half", goalId: "old-goal", date: "2026-10-12", amount: 0.5, at: "2026-10-12T11:00:00.000Z" },
    ],
    session: { goalId: "old-goal", startedAt: "2026-10-12T11:00:00.000Z" },
  };
  let n = 0;
  const restored = withFreshIds(backup, () => `new-${++n}`);

  it("gives every goal and entry a new id and keeps entries on their goal", () => {
    expect(restored.goals[0]).toEqual({ ...goal, id: "new-1" });
    expect(restored.entries).toEqual([{ ...backup.entries[0], id: "new-2", goalId: "new-1" }]);
  });

  it("gives an older goal with no creation time a real one", () => {
    const [old] = withFreshIds({ ...backup, goals: [{ ...goal, createdAt: "" }] }).goals;
    expect(Number.isNaN(Date.parse(old.createdAt))).toBe(false);
  });

  it("drops the link to a saved job, which belongs to the account the backup came from", () => {
    const linked = { ...backup, entries: [{ ...backup.entries[0], savedJobId: "someone-elses-job" }] };
    expect(withFreshIds(linked).entries[0]).not.toHaveProperty("savedJobId");
  });

  it("drops entries the database would refuse (no goal, or not a whole count) and the old session", () => {
    expect(restored.entries).toHaveLength(1);
    expect(restored.session).toBeNull();
  });
});
