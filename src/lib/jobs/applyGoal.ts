import type { Goal } from "../types";

/** Which goal a job marked Applied counts toward (user, 2026-10-26: ask once, then remember). */
export type AppliedGoal = { kind: "goal"; goal: Goal } | { kind: "ask"; options: Goal[] } | { kind: "none" };

/** A goal about applications, by its words: "Send applications", "Submit job applications". */
export function isApplicationsGoal(goal: Goal): boolean {
  return /application/i.test(goal.unit) || /application/i.test(goal.title);
}

/** The remembered goal if it still exists; else the one applications goal; else ask, applications goals first. A goal
 *  about something else is never picked on its own, even when it is the only one: an application isn't a coffee chat.
 *  No goals: nothing to count. */
export function goalForApplied(goals: Goal[], rememberedId: string | null): AppliedGoal {
  if (goals.length === 0) return { kind: "none" };
  const remembered = goals.find((g) => g.id === rememberedId);
  if (remembered) return { kind: "goal", goal: remembered };
  const applications = goals.filter(isApplicationsGoal);
  if (applications.length === 1) return { kind: "goal", goal: applications[0] };
  return { kind: "ask", options: [...applications, ...goals.filter((g) => !isApplicationsGoal(g))] };
}
