import type { Goal } from "./types";

/** The line in Titi's speech bubble while you work through today's number.
 *  The very first time, before anything was ever logged, it says how (progressive onboarding: one tip, in place). */
export function sessionLine(done: number, total: number, firstTime = false): string {
  const left = total - done;
  if (done === 0 && firstTime) return "Every one you do is a fish for me!";
  if (done === 0) return "Ready when you are";
  // Past today's number the extras still count (teacher, 2026-10-28: extra treats added no fish)
  if (left < 0) return `${-left} extra, Titi is stuffed!`;
  if (left === 0) return "Titi is so full";
  if (left === 1) return "One more and Titi is full!";
  if (done === 1) return "First one down!";
  return `${done} down, ${left} to go!`;
}

/** The line under the fish: "2 of 5 done", and once past today's number, how many extra. */
export function fishCount(done: number, total: number): string {
  const extra = done - total;
  return extra > 0 ? `${done} of ${total} done, ${extra} extra!` : `${done} of ${total} done`;
}

/** Whether logging `amount` is the one that reaches today's number. Extras logged after it keep the session open,
 *  so each one adds a fish instead of replaying the celebration. */
export function crossesQuota(amount: number, doneBefore: number, quota: number): boolean {
  return doneBefore < quota && doneBefore + amount >= quota;
}

export type BowlFill = "empty" | "some" | "full";

/** How full Titi's bowl looks: fish go in as you log, and it is heaped once today's number is reached. */
export function bowlFill(done: number, total: number): BowlFill {
  // Empty until today's number is reached: the fish tiles carry the count, so the bowl never shows a number of its own
  // (reviewer, 2026-10-18: "some" fish in the bowl did not match 1 / 5)
  return total > 0 && done >= total ? "full" : "empty";
}

export interface DoneStat {
  label: string;
  value: number;
  suffix: string;
  /** A unit that follows the number as it counts up, so "1 day" never reads "0 day" on the way. */
  unit?: { one: string; many: string };
}

/** The three numbers on the done screen: today's fish, the streak, and how far the whole goal has come. */
/** The cards under "Done for today!". Today's count is already in the line above them, so the cards add what it does
 *  not say: the streak, and how far the whole goal has come, in words ("56 of 150", not "Road to 150 37%") (reviewer,
 *  user 2026-10-19). `doneToday` stays in the signature for the callers. */
export function doneStats(goal: Goal, { doneTotal, streakDays }: { doneToday: number; doneTotal: number; streakDays: number }): DoneStat[] {
  const road =
    goal.type === "by-date"
      ? { label: "So far", value: doneTotal, suffix: ` of ${goal.target}` }
      : { label: "All time", value: doneTotal, suffix: "" };
  return [{ label: "Streak", value: streakDays, suffix: "", unit: { one: " day", many: " days" } }, road];
}

const MILESTONES: [number, string][] = [
  [0.75, "Three quarters of the road, almost there!"],
  [0.5, "Halfway there!"],
  [0.25, "A quarter of the road done, nice!"],
];

/** For a by-date goal: the milestone today crossed, if any (the highest one between yesterday's total and today's). */
export function milestoneLine(goal: Goal, doneTotal: number, doneToday: number): string | null {
  if (goal.type !== "by-date" || goal.target <= 0) return null;
  const before = (doneTotal - doneToday) / goal.target;
  const now = doneTotal / goal.target;
  const hit = MILESTONES.find(([m]) => before < m && now >= m);
  return hit ? hit[1] : null;
}
