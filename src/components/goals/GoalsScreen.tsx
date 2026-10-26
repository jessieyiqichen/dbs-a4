"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ProgressScreen } from "@/components/progress/ProgressScreen";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StorageNotice } from "@/components/ui/StorageNotice";
import { Toast } from "@/components/ui/Toast";
import { restoreGoal } from "@/lib/actions";
import { toISODate } from "@/lib/dates";
import type { Removed } from "@/lib/goals";
import { planToday } from "@/lib/quota";
import { stashRemoved, useRemoved, useStore } from "@/lib/store";
import { useDesktop } from "@/lib/useDesktop";
import { AccountSection } from "./AccountSection";
import { BackupSection } from "./BackupSection";
import { GoalCard } from "./GoalCard";

const HEADER = (
  <PageHeader
    title="Your goals"
    intro="Tap one to see progress, edit or remove"
    back={null}
  />
);

interface Props {
  /** The goal to show beside the list on a desktop (its own page); the first goal when not given. */
  selected?: string;
  /** Came from Today, so the goal's back link returns there. */
  fromToday?: boolean;
}

/** Your goals as a list of cards; a goal just removed on its progress page can be put back from here. On a desktop the
 *  list is the left four columns and the chosen goal's progress the right eight, so Goals and a goal's page are one
 *  page (list and detail); on a phone the list opens each goal's own page. */
export function GoalsScreen({ selected, fromToday = false }: Props) {
  const state = useStore();
  const desktop = useDesktop();
  const removed: Removed | null = useRemoved();
  const closeToast = useCallback(() => stashRemoved(null), []);

  if (state === null)
    return (
      <>
        {HEADER}
        <p className="pt-6 text-muted">Loading your goals…</p>
      </>
    );
  if (state.kind === "corrupt")
    return (
      <>
        {HEADER}
        <StorageNotice state={state} />
      </>
    );

  const { data } = state;
  const today = toISODate(new Date());
  const chosen = desktop
    ? (data.goals.find((g) => g.id === selected) ?? data.goals[0] ?? null)
    : null;
  const list = (
    <>
      {HEADER}
      {!state.persistent && <StorageNotice state={state} />}
      {data.goals.length === 0 ? (
        <div className="mt-8 flex flex-col gap-4">
          <p className="text-lg font-bold text-ink">
            No goals yet, Titi is waiting
          </p>
          <ButtonLink href="/goals/new" className="self-start">
            Add a goal
          </ButtonLink>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {data.goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              plan={planToday(goal, data.entries, today)}
              today={today}
              selected={goal.id === chosen?.id}
            />
          ))}
        </ul>
      )}
      {/* With no goals the empty state already has "Add a goal"; a second add button looked like a bug (first-run check 2) */}
      {data.goals.length > 0 && (
        <ButtonLink
          href="/goals/new"
          variant="secondary"
          className="mt-5 self-start"
        >
          + Add a goal
        </ButtonLink>
      )}
    </>
  );
  // Settings, apart from the goals and under them: when to nudge, the backup and the account, as rows of one kind (user,
  // 2026-10-19: a link beside a big card did not read as one set). On a desktop they sit at the foot of the list column, level
  // with the goal's own actions at the foot of the right one (user, 2026-10-19: the two sides must line up).
  const settings = (
    <div className="mt-10 flex flex-col gap-2 border-t-2 border-wash-strong pt-5 lg:mt-auto">
      <Link
        href="/reminders"
        className="flex items-center justify-between rounded-3xl bg-wash px-5 py-3 font-display text-lg font-semibold text-ink hover:bg-wash-strong focus-visible:outline-3 focus-visible:outline-focus"
      >
        Reminder times
        <span aria-hidden="true" className="text-muted">
          →
        </span>
      </Link>
      <BackupSection data={data} />
      <AccountSection />
    </div>
  );
  const toast = (
    <Toast
      message={removed ? `Removed ${removed.goal.title}` : null}
      onUndo={() => {
        if (removed) restoreGoal(removed);
        stashRemoved(null);
      }}
      onClose={closeToast}
    />
  );
  if (!chosen)
    return (
      <>
        {list}
        {settings}
        {toast}
      </>
    );
  return (
    <div className="grid grid-cols-12 items-start gap-x-8">
      <div className="col-span-4 flex flex-col self-stretch [&>a:last-of-type]:mb-10">
        {list}
        {settings}
      </div>
      <div className="col-span-8 col-start-5 flex flex-col self-stretch">
        <ProgressScreen id={chosen.id} fromToday={fromToday} embedded />
      </div>
      {toast}
    </div>
  );
}
