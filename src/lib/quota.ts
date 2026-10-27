import { addDays, daysBetween, eachDay } from "./dates";
import type { DayStatus, Entry, Goal, Pause } from "./types";

export interface TodayPlan {
  quota: number;
  doneToday: number;
  leftToday: number;
  doneTotal: number;
  /** Active days from today to the deadline, inclusive; null for daily goals. */
  daysLeft: number | null;
  /** How far behind the even plan the goal was at the end of yesterday. */
  behindBy: number;
  status: DayStatus;
}

export function isPaused(goal: Goal, date: string): boolean {
  return goal.pauses.some((p) => p.from <= date && date <= p.to);
}

/** The break that covers this day, if any: Today and the goal's card say when it ends. */
export function breakOn(goal: Goal, date: string): Pause | undefined {
  return goal.pauses.find((p) => p.from <= date && date <= p.to);
}

function activeDays(goal: Goal, from: string, to: string): number {
  return eachDay(from, to).filter((d) => !isPaused(goal, d)).length;
}

function sumWhere(entries: Entry[], goalId: string, test: (date: string) => boolean): number {
  return entries
    .filter((e) => e.goalId === goalId && test(e.date))
    .reduce((total, e) => total + e.amount, 0);
}

function byDateNumbers(goal: Goal, doneBefore: number, today: string) {
  const deadline = goal.deadline ?? today;
  const remaining = Math.max(goal.target - doneBefore, 0);
  const daysLeft = daysBetween(today, deadline) >= 0 ? activeDays(goal, today, deadline) : 0;
  const quota = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining;

  const planDays = activeDays(goal, goal.startDate, deadline);
  const daysSoFar = today > goal.startDate ? activeDays(goal, goal.startDate, addDays(today, -1)) : 0;
  const expected = planDays > 0 ? (goal.target * daysSoFar) / planDays : 0;
  const behindBy = Math.max(Math.round(expected - doneBefore), 0);

  return { quota, daysLeft, behindBy };
}

function statusFor(goal: Goal, plan: Omit<TodayPlan, "status">, today: string): DayStatus {
  if (goal.type === "by-date" && plan.doneTotal >= goal.target) return "complete";
  if (goal.type === "by-date" && goal.deadline !== null && goal.deadline < today) return "deadline-passed";
  if (isPaused(goal, today)) return "paused";
  if (plan.doneToday >= plan.quota && plan.quota > 0) return "done";
  if (plan.doneToday > 0) return "started";
  return "not-started";
}

export function planToday(goal: Goal, entries: Entry[], today: string): TodayPlan {
  const doneToday = sumWhere(entries, goal.id, (d) => d === today);
  const doneBefore = sumWhere(entries, goal.id, (d) => d < today);
  const numbers =
    goal.type === "daily"
      ? { quota: goal.target, daysLeft: null, behindBy: 0 }
      : byDateNumbers(goal, doneBefore, today);

  const base = {
    ...numbers,
    doneToday,
    leftToday: Math.max(numbers.quota - doneToday, 0),
    doneTotal: doneBefore + doneToday,
  };
  return { ...base, status: statusFor(goal, base, today) };
}

// A goal you've started stays on top until it's done, so it never jumps away mid-task.
const URGENCY: Record<DayStatus, number> = {
  started: 0,
  "not-started": 1,
  done: 2,
  paused: 3,
  "deadline-passed": 4,
  complete: 5,
};

export interface PlannedGoal {
  goal: Goal;
  plan: TodayPlan;
}

/** Started first, then not started (furthest behind first), then done, paused and finished. */
export function sortByUrgency(goals: Goal[], entries: Entry[], today: string): PlannedGoal[] {
  return goals
    .map((goal) => ({ goal, plan: planToday(goal, entries, today) }))
    .sort((a, b) => URGENCY[a.plan.status] - URGENCY[b.plan.status] || b.plan.behindBy - a.plan.behindBy);
}
