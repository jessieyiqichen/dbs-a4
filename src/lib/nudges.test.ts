import { describe, expect, it } from "vitest";
import { breakBack, breakTitle, calendarLine, levelFor, nudgeLine, showNudgePrompt, sleepTalk } from "./nudges";
import { breakOn, planToday } from "./quota";
import type { Entry, Goal } from "./types";

const goal: Goal = {
  id: "g1", verb: "", title: "Send LinkedIn connection requests", unit: "connections", type: "by-date",
  target: 500, deadline: "2026-12-01", link: null, startDate: "2026-10-17", pauses: [],
  createdAt: "2026-10-17T09:00:00.000Z",
};
const entry = (date: string, amount: number): Entry => ({ id: "e", goalId: "g1", date, amount, at: "" });

describe("levelFor", () => {
  it("gets firmer through the day", () => {
    expect(levelFor(9)).toBe("gentle");
    expect(levelFor(14)).toBe("firmer");
    expect(levelFor(19)).toBe("last-call");
  });
});

describe("nudgeLine", () => {
  const today = "2026-10-17";

  it("uses a different line on consecutive days", () => {
    const plan = planToday(goal, [], today);
    const a = nudgeLine(goal, plan, today, 9);
    const b = nudgeLine(goal, plan, "2026-10-18", 9);
    expect(a).not.toBe(b);
  });

  it("is the same line all day for the same level", () => {
    const plan = planToday(goal, [], today);
    expect(nudgeLine(goal, plan, today, 9)).toBe(nudgeLine(goal, plan, today, 11));
  });

  it("changes tone as the day goes on when nothing is done", () => {
    const plan = planToday(goal, [], today);
    expect(nudgeLine(goal, plan, today, 9)).not.toBe(nudgeLine(goal, plan, today, 21));
  });

  it("encourages once started, without repeating the numbers the headline shows", () => {
    const plan = planToday(goal, [entry(today, 4)], today);
    const line = nudgeLine(goal, plan, today, 21);
    expect(line).not.toMatch(/\d/);
    expect(line).not.toMatch(/zero|late/i);
  });

  it("celebrates a finished day", () => {
    const plan = planToday(goal, [entry(today, 11)], today);
    expect(nudgeLine(goal, plan, today, 21)).not.toMatch(/zero|late/i);
  });

  it("on a break, Titi naps too without repeating the date the sentence above her already says", () => {
    const resting = { ...goal, pauses: [{ from: "2026-10-16", to: "2026-10-30" }] };
    const line = nudgeLine(resting, planToday(resting, [], today), today, 9);
    expect(line).toBe("Titi is napping too, see you then");
  });

  it("never uses shaming words", () => {
    const lines = [9, 15, 21].flatMap((h) =>
      ["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"].map((d) => nudgeLine(goal, planToday(goal, [], d), d, h)),
    );
    lines.forEach((line) => expect(line).not.toMatch(/lazy|fail|should have|shame|again\?/i));
  });
});

describe("length", () => {
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

  it("keeps every nudge to eight words or fewer", () => {
    const days = ["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"];
    const plans = [
      planToday(goal, [], "2026-10-17"),
      planToday(goal, [entry("2026-10-17", 4)], "2026-10-17"),
      planToday(goal, [entry("2026-10-17", 11)], "2026-10-17"),
    ];
    for (const d of days) for (const h of [9, 15, 21]) for (const p of plans) {
      expect(words(nudgeLine(goal, p, d, h))).toBeLessThanOrEqual(8);
      expect(words(calendarLine(d, h))).toBeLessThanOrEqual(8);
    }
  });
});

describe("showNudgePrompt: when to ask \"Nudge you tomorrow?\"", () => {
  const today = "2026-10-19";
  const fresh = { nudgesSetUp: false, nudgePromptSnoozedOn: null };

  it("asks once something has been logged and reminders are not set up yet", () => {
    expect(showNudgePrompt(fresh, today, { logged: false, pinned: false })).toBe(false);
    expect(showNudgePrompt(fresh, today, { logged: true, pinned: false })).toBe(true);
  });

  it("\"Not now\" hides it for the rest of the day only, and it comes back tomorrow", () => {
    expect(showNudgePrompt({ ...fresh, nudgePromptSnoozedOn: today }, today, { logged: true, pinned: false })).toBe(false);
    expect(showNudgePrompt({ ...fresh, nudgePromptSnoozedOn: "2026-10-18" }, today, { logged: true, pinned: false })).toBe(true);
  });

  it("stops asking once reminders are set up, but stays open to show what just happened", () => {
    const setUp = { ...fresh, nudgesSetUp: true };
    expect(showNudgePrompt(setUp, today, { logged: true, pinned: false })).toBe(false);
    expect(showNudgePrompt(setUp, today, { logged: true, pinned: true })).toBe(true);
  });
});

describe("sleepTalk: what Titi mumbles while she naps before you start", () => {
  it("is a dream about fish that gets more pointed as the day goes on", () => {
    expect(sleepTalk("gentle")).toBe("Zzz… one fish would wake me up");
    expect(sleepTalk("firmer")).toBe("Zzz… is it fish time yet?");
    expect(sleepTalk("last-call")).toBe("Zzz… one fish before bed?");
  });
  it("keeps the house style: no full stop, no tilde", () => {
    for (const level of ["gentle", "firmer", "last-call"] as const) expect(sleepTalk(level)).not.toMatch(/[.~]$/);
  });
});

describe("a goal on a break (A3 review: a break needs a clearer signal)", () => {
  const resting = { ...goal, pauses: [{ from: "2026-10-20", to: "2026-10-30" }] };

  it("finds the break that covers a day, and none outside it", () => {
    expect(breakOn(resting, "2026-10-25")).toEqual({ from: "2026-10-20", to: "2026-10-30" });
    expect(breakOn(resting, "2026-10-31")).toBeUndefined();
  });

  it("says until when on Today, and when it's back on the goal's card", () => {
    expect(breakTitle("2026-10-30")).toBe("On a break until Oct 30");
    expect(breakBack("2026-10-30")).toBe("Back Oct 30");
  });
});
