import { describe, expect, it } from "vitest";
import { blankPicks, resolveSetup, toggleStarter, type Picks } from "./quickSetup";

const today = "2026-10-18";
// Every row answered: LinkedIn, in a month, steady (what the first screen used to pick for you)
const FIRST_PICKS: Picks = { ...blankPicks("linkedin"), when: "1m", tier: 1 };

describe("resolveSetup: the one-screen first visit", () => {
  it("is ready to start from the first screen: LinkedIn, in a month, steady", () => {
    const r = resolveSetup(FIRST_PICKS, today);
    expect(r.type).toBe("by-date");
    expect(r.deadline).toBe("2026-11-18");
    expect(r.tiers.map((t) => t.amount)).toEqual([50, 150, 300]);
    expect(r.perDay).toBe(5); // 150 over the 32 days from Oct 18 to Nov 18
    expect(r.goal).toMatchObject({ verb: "Send", unit: "connection requests", target: 150, deadline: "2026-11-18" });
    expect(r.errors).toEqual({});
  });

  it("asks no date for a daily goal, and its tiers are a day's number", () => {
    const r = resolveSetup({ ...FIRST_PICKS, starter: "applications", tier: 0, site: "linkedin-jobs" }, today);
    expect(r.type).toBe("daily");
    expect(r.deadline).toBe("");
    expect(r.perDay).toBe(1);
    expect(r.goal).toMatchObject({ verb: "Send", unit: "applications", target: 1, deadline: null });
  });

  it("takes a goal of your own, and says what is missing beside the right field", () => {
    const own: Picks = { ...FIRST_PICKS, starter: "own", ownType: "daily", ownText: "" };
    expect(resolveSetup(own, today).errors.what).toBe('Enter what you\'ll do, like "Send cold emails"');
    expect(resolveSetup(own, today).goal).toBeNull();
    const done = resolveSetup({ ...own, ownText: "write cover letters", tier: "own", ownAmount: "2" }, today);
    expect(done.goal).toMatchObject({ verb: "Write", unit: "cover letters", target: 2 });
  });

  it("checks a typed number and a picked date, with examples that fit", () => {
    expect(resolveSetup({ ...FIRST_PICKS, tier: "own", ownAmount: "lots" }, today).errors.amount).toBe("Enter a whole number, like 150");
    expect(resolveSetup({ ...FIRST_PICKS, starter: "interview", tier: "own", ownAmount: "lots" }, today).errors.amount).toBe("Enter a whole number, like 3");
    expect(resolveSetup({ ...FIRST_PICKS, starter: "interview", tier: "own", ownAmount: "0" }, today).errors.amount).toBe("Enter a number above 0, like 3");
    expect(resolveSetup({ ...FIRST_PICKS, when: "pick", pickedDate: "" }, today).errors.date).toBe("Pick the date you want to finish by");
    expect(resolveSetup({ ...FIRST_PICKS, when: "pick", pickedDate: "2026-10-18" }, today).errors.date).toBe("Pick a date after today");
  });
});

describe("resolveSetup: where job applications are made", () => {
  it("offers recruiting sites for job applications, and none at all", () => {
    const r = resolveSetup({ ...FIRST_PICKS, starter: "applications", site: "linkedin-jobs" }, today);
    expect(r.sites.map((s) => s.label)).toEqual(["LinkedIn Jobs", "Handshake", "Indeed", "No site"]);
    expect(r.goal?.link).toBe("https://www.linkedin.com/jobs/");
    expect(resolveSetup({ ...FIRST_PICKS, starter: "applications", site: "handshake" }, today).goal?.link).toBe("https://app.joinhandshake.com/");
    expect(resolveSetup({ ...FIRST_PICKS, starter: "applications", site: "none" }, today).goal?.link).toBeNull();
  });

  it("asks no site for the others", () => {
    expect(resolveSetup(FIRST_PICKS, today).sites).toEqual([]);
  });
});

describe("resolveSetup: nothing is picked for you (teacher, 2026-10-28)", () => {
  it("has no number and no goal until every row is answered, and says which rows are left", () => {
    const r = resolveSetup(blankPicks("linkedin"), today);
    expect(r.goal).toBeNull();
    expect(r.perDay).toBeNull();
    expect(r.errors).toEqual({ when: "Pick when you'll finish", amount: "Pick how many" });
    expect(resolveSetup({ ...blankPicks("linkedin"), when: "1m" }, today).errors).toEqual({ amount: "Pick how many" });
  });

  it("asks where job applications are made, with No site as an answer", () => {
    expect(resolveSetup({ ...blankPicks("applications"), tier: 0 }, today).errors).toEqual({ site: "Pick where you apply, or No site" });
    expect(resolveSetup({ ...blankPicks("applications"), tier: 0, site: "none" }, today).goal?.link).toBeNull();
  });

  it("asks how often for a goal of your own, and no date until it is a total by a date", () => {
    const own = { ...blankPicks("own"), ownText: "Send cold emails" };
    expect(resolveSetup(own, today).type).toBeNull();
    expect(resolveSetup(own, today).errors).toEqual({ often: "Pick how often", amount: "Pick how many" });
    expect(resolveSetup({ ...own, ownType: "by-date" }, today).errors).toEqual({ when: "Pick when you'll finish", amount: "Pick how many" });
  });

  it("gives no day's number for a total until the date is known", () => {
    expect(resolveSetup(blankPicks("linkedin"), today).tiers.map((t) => t.perDay)).toEqual([null, null, null]);
    expect(resolveSetup({ ...blankPicks("linkedin"), when: "1m" }, today).tiers.map((t) => t.perDay)).toEqual([2, 5, 10]);
  });
});

describe("toggleStarter: several things at once (teacher, 2026-10-28)", () => {
  it("adds a thing with nothing else picked, keeps the others' answers, and takes it off again", () => {
    const one = toggleStarter([], "linkedin");
    expect(one).toEqual([blankPicks("linkedin")]);
    const answered = [{ ...one[0], when: "1m" }];
    const two = toggleStarter(answered, "interview");
    expect(two).toEqual([{ ...blankPicks("linkedin"), when: "1m" }, blankPicks("interview")]);
    expect(toggleStarter(two, "linkedin")).toEqual([blankPicks("interview")]);
  });
});
