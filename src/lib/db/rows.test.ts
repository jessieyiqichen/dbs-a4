import { describe, expect, it } from "vitest";
import { entryToRow, goalToRow, rowToEntry, rowToGoal } from "./rows";
import type { Entry, Goal } from "../types";

const goal: Goal = {
  id: "0b5c7d1e-1111-4a2b-9c3d-000000000001",
  verb: "Send",
  title: "Send connection requests",
  unit: "connections",
  type: "by-date",
  target: 500,
  deadline: "2026-12-01",
  link: "https://www.linkedin.com",
  startDate: "2026-10-26",
  pauses: [{ from: "2026-10-28", to: "2026-10-29" }],
  createdAt: "2026-10-26T15:00:00.000Z",
};

const entry: Entry = {
  id: "0b5c7d1e-2222-4a2b-9c3d-000000000002",
  goalId: goal.id,
  date: "2026-10-26",
  amount: 3,
  at: "2026-10-26T15:30:00.000Z",
};

describe("goal rows", () => {
  it("turns a goal into a row with its place in the list, and never sends user_id", () => {
    const row = goalToRow(goal, 2);
    expect(row).toMatchObject({ id: goal.id, start_date: "2026-10-26", created_at: goal.createdAt, position: 2, history: [] });
    expect(row).not.toHaveProperty("user_id");
  });

  it("reads a row back as the same goal", () => {
    expect(rowToGoal({ ...goalToRow(goal, 0), user_id: "user_abc" })).toEqual(goal);
  });

  it("keeps a goal's history when it has one", () => {
    const edited = { ...goal, history: [{ to: "2026-10-27", target: 300, type: "by-date" as const, deadline: "2026-11-30" }] };
    expect(rowToGoal(goalToRow(edited, 0))).toEqual(edited);
  });

  it("reads Postgres timestamps in the same form the app writes", () => {
    const row = { ...goalToRow(goal, 0), created_at: "2026-10-26T15:00:00+00:00" };
    expect(rowToGoal(row)?.createdAt).toBe("2026-10-26T15:00:00.000Z");
  });

  it("drops a row with the wrong shape instead of trusting it", () => {
    expect(rowToGoal({ ...goalToRow(goal, 0), target: "500" })).toBeNull();
    expect(rowToGoal({ ...goalToRow(goal, 0), type: "weekly" })).toBeNull();
    expect(rowToGoal({ ...goalToRow(goal, 0), pauses: "none" })).toBeNull();
    expect(rowToGoal(null)).toBeNull();
  });

  it("drops malformed history records but keeps the goal", () => {
    const row = { ...goalToRow(goal, 0), history: [{ to: "soon" }] };
    expect(rowToGoal(row)).toEqual(goal);
  });
});

describe("entry rows", () => {
  it("round-trips an entry", () => {
    const row = entryToRow(entry);
    expect(row).toEqual({ id: entry.id, goal_id: goal.id, date: "2026-10-26", amount: 3, at: entry.at });
    expect(rowToEntry({ ...row, user_id: "user_abc", saved_job_id: null, at: "2026-10-26T15:30:00+00:00" })).toEqual(entry);
  });

  it("drops an entry with the wrong shape", () => {
    expect(rowToEntry({ ...entryToRow(entry), amount: "3" })).toBeNull();
    expect(rowToEntry({ ...entryToRow(entry), goal_id: undefined })).toBeNull();
  });
});
