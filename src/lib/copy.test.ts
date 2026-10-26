// House style (user, 2026-10-17): no full stops anywhere in the interface; encouraging lines end with "!" or "".
import { describe, expect, it } from "vitest";
import { calendarLine, nudgeLine } from "./nudges";
import { welcomeMessage } from "./welcome";
import { goalSentence } from "./phrases";
import { dailyPreview, parseCount, parseTime, validateGoal } from "./validate";
import { planToday } from "./quota";
import type { Entry, Goal } from "./types";
import { AUTH_INTRO, clerkLocalization } from "./auth/copy";
import { BACKUP_NOTE, LOAD_FAILED, SAVE_FAILED, SAVED_NOTE } from "./db/copy";
import { addedLine, addLabel, alreadyLine, companyList, foundLine, JOBS_COPY, lookingLine, moreLine, noMatchLine, removedLine, resultsLine, rolesCount, SEARCH_COPY, someDownLine } from "./jobs/copy";

const goal: Goal = {
  id: "g1", verb: "Send", title: "Send connection requests", unit: "connection requests", type: "by-date",
  target: 500, deadline: "2026-12-01", link: null, startDate: "2026-10-10", pauses: [], createdAt: "",
};
const entry = (date: string, amount: number): Entry => ({ id: date + amount, goalId: "g1", date, amount, at: "" });
const DAYS = ["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21"];
const HOURS = [9, 15, 21];

/** Every string in a nested object of interface lines. */
const linesIn = (value: unknown): string[] =>
  typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(linesIn) : [];

/** A full stop is a period followed by a space or the end; decimals like 1.5 are fine. */
const FULL_STOP = /\.(\s|$)/;

function nudges(): string[] {
  const out: string[] = [];
  for (const d of DAYS) for (const h of HOURS) {
    out.push(calendarLine(d, h));
    for (const entries of [[], [entry(d, 4)], [entry(d, 30)]]) out.push(nudgeLine(goal, planToday(goal, entries, d), d, h));
  }
  out.push(nudgeLine(goal, planToday(goal, [entry("2026-10-17", 500)], "2026-10-17"), "2026-10-17", 9)); // complete
  out.push(nudgeLine({ ...goal, deadline: "2026-10-16" }, planToday({ ...goal, deadline: "2026-10-16" }, [entry("2026-10-15", 3)], "2026-10-17"), "2026-10-17", 9)); // deadline passed
  const paused = { ...goal, pauses: [{ from: "2026-10-16", to: "2026-10-20" }] };
  out.push(nudgeLine(paused, planToday(paused, [], "2026-10-17"), "2026-10-17", 9));
  return out;
}

function welcomes(): string[] {
  const t = "2026-10-17";
  const cases = [
    { prevVisit: t, fromNudge: true, entries: [] },
    { prevVisit: "2026-10-16", fromNudge: false, entries: [entry("2026-10-15", 1), entry("2026-10-16", 1)] },
    { prevVisit: "2026-10-16", fromNudge: false, entries: [entry("2026-10-16", 1)] },
    { prevVisit: "2026-10-15", fromNudge: false, entries: [entry("2026-10-15", 1)] },
    { prevVisit: "2026-10-15", fromNudge: false, entries: [] },
    { prevVisit: "2026-10-13", fromNudge: false, entries: [entry("2026-10-13", 1)] },
  ];
  return cases.map((c) => welcomeMessage({ ...c, today: t, goals: [goal] })).filter((m): m is string => m !== null);
}

function errors(): string[] {
  const today = "2026-10-17";
  const bad = [
    { verb: "", unit: "", type: "by-date" as const, target: "", deadline: "", link: "" },
    { verb: "x".repeat(60), unit: "y".repeat(60), type: "by-date" as const, target: "999999", deadline: "2026-10-01", link: "not a link" },
  ];
  const out = bad.flatMap((d) => Object.values(validateGoal(d, today).errors).filter(Boolean) as string[]);
  for (const r of [parseCount("abc"), parseCount("5000"), parseTime("25:00")]) if (!r.ok) out.push(r.error);
  return out;
}

describe("house style: no full stops", () => {
  it("nudges end with ! or a plain word and contain no full stop or tilde", () => {
    for (const line of nudges()) {
      expect(line, line).not.toMatch(FULL_STOP);
      expect(line, line).toMatch(/[!A-Za-z0-9]$/);
    }
  });

  it("welcome lines contain no full stop", () => {
    const lines = welcomes();
    expect(lines.length).toBeGreaterThan(3);
    for (const line of lines) expect(line, line).not.toMatch(FULL_STOP);
  });

  it("form errors and previews contain no full stop", () => {
    const lines = [...errors(), dailyPreview("500", "2026-12-01", "connection requests", "2026-10-17")!.message, dailyPreview("5000", "2026-10-20", "connection requests", "2026-10-17")!.message];
    expect(lines.length).toBeGreaterThan(5);
    for (const line of lines) expect(line, line).not.toMatch(FULL_STOP);
  });

  it("the goal sentence has no full stop", () => {
    expect(goalSentence({ verb: "Send", unit: "connection requests", type: "by-date", target: 500, deadline: "2026-12-01" })).not.toMatch(FULL_STOP);
  });

  it("the sign-in and sign-up lines, ours and every Clerk line we rewrite, have no full stop", () => {
    const lines = [AUTH_INTRO, ...linesIn(clerkLocalization)];
    expect(lines.length).toBeGreaterThan(20);
    for (const line of lines) expect(line, line).not.toMatch(FULL_STOP);
  });

  it("Clerk's error lines, as we rewrite them, don't end in \"!\"", () => {
    const errors = linesIn(clerkLocalization.unstable__errors);
    expect(errors.length).toBeGreaterThan(10);
    for (const line of errors) expect(line, line).not.toMatch(/!$/);
  });

  it("the saving and loading lines have no full stop, and the errors no \"!\"", () => {
    const errorLines = [LOAD_FAILED.title, LOAD_FAILED.next, SAVE_FAILED];
    for (const line of [...errorLines, SAVED_NOTE, BACKUP_NOTE]) expect(line, line).not.toMatch(FULL_STOP);
    for (const line of errorLines) expect(line, line).not.toMatch(/!$/);
  });

  it("the Jobs page lines have no full stop, and its errors no \"!\"", () => {
    const lines = [
      ...linesIn(JOBS_COPY), rolesCount(1), rolesCount(139), foundLine("Figma", "greenhouse", 139), foundLine("Webflow", "greenhouse", 0),
      addLabel("Figma"), addedLine("Figma"), removedLine("Figma"), alreadyLine("Figma"),
    ];
    for (const line of lines) expect(line, line).not.toMatch(FULL_STOP);
    const errors = [JOBS_COPY.emptyName, JOBS_COPY.notFound, JOBS_COPY.emptyLink, JOBS_COPY.unavailable, JOBS_COPY.saveFailed, ...linesIn(JOBS_COPY.loadFailed)];
    for (const line of errors) expect(line, line).not.toMatch(/!$/);
  });

  it("the search lines have no full stop, read naturally, and the errors take no \"!\"", () => {
    expect(companyList(["Anthropic", "Figma", "Notion"])).toBe("Anthropic, Figma and Notion");
    expect(companyList(["A", "B", "C", "D", "E"])).toBe("your 5 companies");
    expect(resultsLine(1, "", ["Figma"])).toBe("1 role at Figma, newest first");
    const names = ["Anthropic", "Figma"];
    const lines = [...linesIn(SEARCH_COPY), lookingLine(names), resultsLine(12, "product manager", names), resultsLine(212, "", names), moreLine(50, 212), noMatchLine("xyz"), someDownLine(["Palantir"])];
    for (const line of lines) expect(line, line).not.toMatch(FULL_STOP);
    for (const line of [SEARCH_COPY.allDown, noMatchLine("xyz"), someDownLine(["Palantir"])]) expect(line, line).not.toMatch(/!$/);
  });
});
