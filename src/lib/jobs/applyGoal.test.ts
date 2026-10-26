import { describe, expect, it } from "vitest";
import { goalForApplied, isApplicationsGoal } from "./applyGoal";
import type { Goal } from "../types";

const goal = (id: string, unit: string): Goal => ({
  id, verb: "Send", title: `Send ${unit}`, unit, type: "daily", target: 3, deadline: null, link: null, startDate: "2026-10-26", pauses: [], createdAt: "2026-10-26T10:00:00.000Z",
});
const apps = goal("apps", "applications");
const chats = goal("chats", "coffee chats");
const more = goal("more", "job applications");

describe("isApplicationsGoal", () => {
  it("knows a goal about applications by its words", () => {
    expect(isApplicationsGoal(apps)).toBe(true);
    expect(isApplicationsGoal(more)).toBe(true);
    expect(isApplicationsGoal(chats)).toBe(false);
  });
});

describe("goalForApplied (user, 2026-10-26: ask once, then remember)", () => {
  it("counts on the one goal about applications, without asking", () => {
    expect(goalForApplied([chats, apps], null)).toEqual({ kind: "goal", goal: apps });
  });

  it("asks rather than count an application on a goal about something else, even the only one", () => {
    expect(goalForApplied([chats], null)).toEqual({ kind: "ask", options: [chats] });
  });

  it("asks when it can't tell, offering every goal, applications ones first", () => {
    expect(goalForApplied([chats, apps, more], null)).toEqual({ kind: "ask", options: [apps, more, chats] });
    expect(goalForApplied([chats, goal("x", "interviews")], null)).toMatchObject({ kind: "ask" });
  });

  it("remembers the pick, and asks again if that goal is gone", () => {
    expect(goalForApplied([chats, apps, more], "more")).toEqual({ kind: "goal", goal: more });
    expect(goalForApplied([chats, apps, more], "deleted")).toMatchObject({ kind: "ask" });
  });

  it("counts nothing when there are no goals", () => {
    expect(goalForApplied([], null)).toEqual({ kind: "none" });
  });
});
