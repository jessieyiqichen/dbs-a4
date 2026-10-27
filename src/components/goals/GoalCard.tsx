"use client";

import Link from "next/link";
import { formatShortDate } from "@/lib/dates";
import { formatCount } from "@/lib/format";
import { breakBack } from "@/lib/nudges";
import { breakOn, type TodayPlan } from "@/lib/quota";
import type { Goal } from "@/lib/types";

interface Props {
  goal: Goal;
  plan: TodayPlan;
  today: string;
  /** The goal shown beside the list on a desktop. */
  selected?: boolean;
}

function line(goal: Goal, plan: TodayPlan, today: string): string {
  const pause = breakOn(goal, today);
  if (pause) return breakBack(pause.to);
  if (plan.status === "complete") return "Goal reached!";
  if (plan.status === "deadline-passed")
    return `${plan.doneTotal} of ${goal.target}, the date passed`;
  if (goal.type === "daily")
    return plan.status === "done"
      ? "Done for today!"
      : `${formatCount(goal.target, goal.unit)} a day`;
  return `${plan.doneTotal} of ${goal.target} by ${formatShortDate(goal.deadline ?? today)}`;
}

/** One goal in the list: the whole card opens its progress; edit, pause and delete live there. A goal on a break sits
 *  back on the page's own wash with an "On a break" tag and a faded bar, so it can't be taken for one in progress (A3
 *  review, 2026-10-26: a break needs a clearer signal). */
export function GoalCard({ goal, plan, today, selected = false }: Props) {
  const pct =
    goal.type === "by-date"
      ? Math.min(
          100,
          Math.round((plan.doneTotal / Math.max(goal.target, 1)) * 100),
        )
      : null;
  const done = plan.status === "done" || plan.status === "complete";
  const resting = plan.status === "paused";
  const face = selected ? "bg-primary-soft [--lip:var(--color-lip)]" : resting ? "bg-wash hover:bg-wash-strong" : "bg-surface hover:bg-wash";
  return (
    <li>
      <Link
        href={`/goals/${goal.id}`}
        aria-current={selected ? "page" : undefined}
        className={`clay clay-press flex flex-col gap-2 rounded-3xl px-5 py-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus ${face}`}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-semibold text-ink">
              {goal.title}
            </span>
            {resting && (
              <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-extrabold text-ink">
                On a break
              </span>
            )}
          </span>
          {!done && !selected && (
            <span aria-hidden="true" className="text-muted">
              →
            </span>
          )}
        </span>
        <span className="text-sm font-bold text-muted">
          {line(goal, plan, today)}
        </span>
        {pct !== null && (
          <span
            className={`h-2.5 w-full overflow-hidden rounded-full bg-wash-strong ${resting ? "opacity-50" : ""}`}
            role="progressbar"
            aria-label={`${goal.title}: ${pct}% of the way`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <span
              className="block h-full rounded-full bg-reward"
              style={{ width: `${pct}%` }}
            />
          </span>
        )}
      </Link>
    </li>
  );
}
