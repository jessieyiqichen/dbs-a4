"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { updateSettings } from "@/lib/actions";
import { toISODate } from "@/lib/dates";
import { goalForApplied } from "@/lib/jobs/applyGoal";
import { addedToGoal, JOBS_COPY, removedLine, SAVED_COPY, savedWhen, SEARCH_COPY } from "@/lib/jobs/copy";
import { postedAgo, savedKey, type SavedJob } from "@/lib/jobs/saved";
import { applySaved, removeSavedJob, unapplySaved, undoRemoveSaved } from "@/lib/jobs/savedStore";
import type { Goal } from "@/lib/types";

export type Notify = (text: string, undo?: () => void) => void;

interface SavedListProps {
  jobs: SavedJob[];
  closed: Set<string>;
  goals: Goal[];
  rememberedGoalId: string | null;
  notify: Notify;
}

/** The saved jobs on Jobs (6d): mark one applied (one more fish on a goal), take it back, or remove it. Most applying
 *  happens on the applications goal's own page; this list is where they are kept in order. */
export function SavedList({ jobs, closed, goals, rememberedGoalId, notify }: SavedListProps) {
  if (jobs.length === 0) return <p className="font-bold text-muted">{SAVED_COPY.empty}</p>;
  return (
    <ul className="flex flex-col">
      {jobs.map((job) => (
        <SavedRow key={job.id} job={job} closed={closed.has(savedKey(job))} goals={goals} rememberedGoalId={rememberedGoalId} notify={notify} />
      ))}
    </ul>
  );
}

function SavedRow({ job, closed, goals, rememberedGoalId, notify }: Omit<SavedListProps, "jobs" | "closed"> & { job: SavedJob; closed: boolean }) {
  const [asking, setAsking] = useState<Goal[] | null>(null);
  const [picked, setPicked] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const applied = job.status === "applied";
  const details = [job.company, job.location, savedWhen(job.status, postedAgo(applied ? job.appliedAt : job.savedAt))].filter(Boolean).join(" · ");

  async function apply(goal: Goal | null) {
    setBusy(true);
    const entryId = await applySaved(job, goal?.id ?? null, toISODate(new Date()));
    setBusy(false);
    setAsking(null);
    if (entryId === false) return notify(JOBS_COPY.saveFailed);
    const undo = () => void unapplySaved(job);
    notify(goal ? addedToGoal(goal.title) : SAVED_COPY.noGoal, undo);
  }

  function tapApplied() {
    if (applied) {
      void unapplySaved(job).then((ok) => notify(ok ? SAVED_COPY.backToSaved : JOBS_COPY.saveFailed));
      return;
    }
    const choice = goalForApplied(goals, rememberedGoalId);
    if (choice.kind === "ask") {
      setPicked(choice.options[0].id);
      return setAsking(choice.options);
    }
    void apply(choice.kind === "goal" ? choice.goal : null);
  }

  function countIt() {
    const goal = asking?.find((g) => g.id === picked);
    if (!goal) return;
    // Asked once, then remembered (user, 2026-10-26)
    updateSettings({ applyGoalId: goal.id });
    void apply(goal);
  }

  async function remove() {
    if (await removeSavedJob(job)) notify(removedLine(job.title), () => void undoRemoveSaved(job));
    else notify(JOBS_COPY.saveFailed);
  }

  return (
    <li className="flex flex-col gap-2 border-b-2 border-wash-strong py-4 last:border-b-0">
      <p className="font-display text-lg font-semibold leading-snug text-ink">{job.title}</p>
      <p className="text-sm font-bold text-muted">{details}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={tapApplied} disabled={busy || asking !== null} aria-pressed={applied}
          className={applied ? "bg-primary-soft [--lip:var(--color-lip)]" : ""}>
          {applied ? SAVED_COPY.applied : SAVED_COPY.iApplied}
        </Button>
        {closed ? (
          <span className="inline-flex min-h-11 items-center font-bold text-muted">{SAVED_COPY.closed}</span>
        ) : (
          <a href={job.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center px-1 font-display font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink focus-visible:outline-3 focus-visible:outline-focus">
            {SEARCH_COPY.view}<span className="sr-only"> {SEARCH_COPY.newTab}</span>
          </a>
        )}
        <Button variant="ghost" onClick={() => void remove()} aria-label={`Remove ${job.title} at ${job.company}`}>{SAVED_COPY.remove}</Button>
      </div>
      {asking && (
        <div className="mt-2 flex flex-col gap-3">
          <RadioGroup name={`goal-${job.id}`} legend={SAVED_COPY.countToward} value={picked}
            options={asking.map((g) => ({ value: g.id, label: g.title }))} onChange={setPicked} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={countIt} disabled={busy}>{SAVED_COPY.countIt}</Button>
            <Button variant="ghost" onClick={() => setAsking(null)}>{SAVED_COPY.notNow}</Button>
          </div>
        </div>
      )}
    </li>
  );
}
