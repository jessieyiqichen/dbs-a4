"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StorageNotice } from "@/components/ui/StorageNotice";
import { Toast } from "@/components/ui/Toast";
import {
  addEntry,
  endSession,
  markVisited,
  removeEntry,
  updateSettings,
} from "@/lib/actions";
import { toISODate } from "@/lib/dates";
import { isApplicationsGoal } from "@/lib/jobs/applyGoal";
import { JOBS_COPY } from "@/lib/jobs/copy";
import { savedKey, type SavedJob } from "@/lib/jobs/saved";
import { applySaved, unapplySaved, useSavedJobs } from "@/lib/jobs/savedStore";
import { formatCount } from "@/lib/format";
import { sortByUrgency, type PlannedGoal } from "@/lib/quota";
import { startGoal } from "@/lib/start";
import {
  getFocusGoal,
  getVisitStart,
  setFocusGoal,
  useStore,
} from "@/lib/store";
import { calendarNotice, catchUpLine, sessionIsToday } from "@/lib/returning";
import { weekBowls } from "@/lib/scene";
import { overallStreak } from "@/lib/streak";
import type { AppData, Goal } from "@/lib/types";
import { backAfterDays, greeting, streakTip } from "@/lib/welcome";
import { showNudgePrompt } from "@/lib/nudges";
import { milestoneLine } from "@/lib/session";
import { RoomSkeleton } from "./Room";
import { DoneToday } from "./DoneToday";
import { FirstVisit } from "./FirstVisit";
import { NudgePrompt } from "./NudgePrompt";
import { Session } from "./Session";
import { TodayHome } from "./TodayHome";
import { StreakChip } from "./StreakChip";

interface Undoable {
  message: string;
  /** Absent for a message with nothing to take back ("That didn't save") */
  undo?: () => void;
}

const ACTIVE = new Set(["not-started", "started"]);

/** The goal in a session goes first, then the one the person picked or just created, then the most urgent. */
function pickFirst(
  items: PlannedGoal[],
  data: AppData,
  picked: string | null,
): PlannedGoal[] {
  // The tab you tapped wins; without one, the goal whose session is under way (user, 2026-10-19: with a session open,
  // tapping another goal's tab did nothing)
  const pinned = picked ?? data.session?.goalId ?? getFocusGoal();
  const index = items.findIndex(
    (item) =>
      item.goal.id === pinned &&
      (data.session ||
        picked === item.goal.id ||
        ACTIVE.has(item.plan.status) ||
        item.plan.status === "done"),
  );
  return index <= 0
    ? items
    : [items[index], ...items.slice(0, index), ...items.slice(index + 1)];
}

/** Is the first goal's session live today, and is its celebration due? Shared by the page and the leave-session check. */
function sessionState(
  data: AppData,
  picked: string | null,
  justDone: string | null,
  today: string,
) {
  const planned = pickFirst(
    sortByUrgency(data.goals, data.entries, today),
    data,
    picked,
  );
  const first = planned[0];
  const asking =
    data.session?.goalId === first.goal.id &&
    sessionIsToday(data.session, today) &&
    ACTIVE.has(first.plan.status);
  const celebrating =
    first.plan.status === "done" && justDone === first.goal.id;
  return { planned, asking, celebrating };
}

/** Today ("/") is Titi's room; the session ("/session") is its own page, so Back returns to the room and the session is
 *  kept for the day. The two views share this component because they share the goal order, the toast and the undo. */
export function TodayScreen({ view = "home" }: { view?: "home" | "session" }) {
  const router = useRouter();
  const state = useStore();
  const [undoable, setUndoable] = useState<Undoable | null>(null);
  const savedJobs = useSavedJobs();
  const [promptPinned, setPromptPinned] = useState(false);
  // The goal whose number was just reached in this visit: the celebration shows once, then Titi's room again.
  const [justDone, setJustDone] = useState<string | null>(null);
  // The goal the person tapped in the switcher; remembered while the app stays open.
  const [picked, setPicked] = useState<string | null>(() => getFocusGoal());
  const closeToast = useCallback(() => setUndoable(null), []);
  const ready = state?.kind === "ready";

  // Remember this visit, and drop ?from=nudge so a refresh doesn't repeat the welcome.
  useEffect(() => {
    if (!ready) return;
    markVisited(toISODate(new Date()));
    if (window.location.search)
      window.history.replaceState(null, "", window.location.pathname);
  }, [ready]);

  // /session with nothing in progress (opened directly, or the session is over) goes back to Today.
  useEffect(() => {
    if (view !== "session" || state?.kind !== "ready") return;
    const { data } = state;
    if (data.goals.length === 0) return router.replace("/");
    const { asking, celebrating } = sessionState(
      data,
      picked,
      justDone,
      toISODate(new Date()),
    );
    if (!asking && !celebrating) router.replace("/");
  }, [view, state, picked, justDone, router]);

  if (state === null) return <RoomSkeleton />;
  if (state.kind === "load-failed") return <StorageNotice state={state} />;

  const { data } = state;
  const now = new Date();
  const today = toISODate(now);
  const log = (goal: Goal, amount: number, reachesQuota: boolean) => {
    const entry = addEntry(goal.id, amount, today);
    if (reachesQuota) {
      endSession();
      setJustDone(goal.id); // today's number is reached: the celebration is the confirmation, so no toast over it
      setUndoable(null);
      return;
    }
    setUndoable({
      message: `Added ${formatCount(amount, goal.unit)}`,
      undo: () => removeEntry(entry.id),
    });
  };
  // "I applied" on a saved job (user, 2026-10-26): the job is marked applied and counts one on this goal, linked to
  // it, so Undo takes back both
  const applied = async (goal: Goal, job: SavedJob, reachesQuota: boolean) => {
    const entryId = await applySaved(job, goal.id, today);
    if (entryId === false) return setUndoable({ message: JOBS_COPY.saveFailed });
    if (reachesQuota) {
      endSession();
      setJustDone(goal.id);
      setUndoable(null);
      return;
    }
    setUndoable({ message: `Added ${formatCount(1, goal.unit)}`, undo: () => void unapplySaved(job) });
  };
  const undo = () => {
    undoable?.undo?.();
    setUndoable(null);
  };

  if (data.goals.length === 0) {
    return (
      <>
        {state.saveFailed && <StorageNotice state={state} />}
        <FirstVisit />
      </>
    );
  }

  const { planned, asking, celebrating } = sessionState(
    data,
    picked,
    justDone,
    today,
  );
  const [first, ...rest] = planned;
  const begin = (goal: Goal) => {
    // Follow the goal being started, so its own done screen shows when it is finished
    setPicked(goal.id);
    setFocusGoal(goal.id);
    startGoal(goal);
    router.push("/session");
  };
  const visit = getVisitStart();
  const hello = greeting({
    ...visit,
    today,
    goals: data.goals,
    entries: data.entries,
  });
  const welcome = hello.text;
  const back = backAfterDays({
    prevVisit: visit.prevVisit,
    today,
    goals: data.goals,
    entries: data.entries,
  });
  const firstTime = data.entries.length === 0;
  const { reminderTimes } = data.settings;
  const logged = data.entries.length > 0;
  const showPrompt = showNudgePrompt(data.settings, today, {
    logged,
    pinned: promptPinned,
  });
  const next = rest.find((item) => ACTIVE.has(item.plan.status))?.goal ?? null;
  const run = overallStreak(data.goals, data.entries, today).days;

  return (
    <>
      {state.saveFailed && <StorageNotice state={state} />}

      {view === "session" ? (
        asking ? (
          <Session
            goal={first.goal}
            total={first.plan.quota}
            done={first.plan.doneToday}
            firstTime={firstTime}
            onLog={(n) =>
              log(first.goal, n, first.plan.doneToday + n >= first.plan.quota)
            }
            saved={
              isApplicationsGoal(first.goal) && savedJobs.kind === "ready"
                ? savedJobs.jobs.filter((j) => j.status === "saved" && !savedJobs.closed.has(savedKey(j)))
                : null
            }
            onApplied={(job) =>
              void applied(first.goal, job, first.plan.doneToday + 1 >= first.plan.quota)
            }
            onOpen={() =>
              first.goal.link &&
              window.open(first.goal.link, "_blank", "noopener,noreferrer")
            }
          />
        ) : celebrating ? (
          <DoneToday
            prompt={
              showPrompt ? (
                <NudgePrompt
                  times={reminderTimes}
                  today={today}
                  onActed={() => setPromptPinned(true)}
                />
              ) : null
            }
            goal={first.goal}
            doneToday={first.plan.doneToday}
            doneTotal={first.plan.doneTotal}
            streakDays={run}
            milestone={milestoneLine(
              first.goal,
              first.plan.doneTotal,
              first.plan.doneToday,
            )}
            next={next}
            onStartNext={() => {
              setJustDone(null);
              closeToast();
              if (next) {
                setPicked(next.id);
                startGoal(next);
              }
            }}
            onContinue={() => {
              setJustDone(null);
              closeToast();
              router.push("/");
            }}
            bowls={weekBowls(data.goals, data.entries, today)}
            // The streak's own moment only on the day's first finished goal, so later ones are not slowed down
            streakMoment={rest.every(
              (item) =>
                item.plan.status !== "done" && item.plan.status !== "complete",
            )}
          />
        ) : null /* nothing in progress: the effect above is sending you to Today */
      ) : (
        <>
          {hello.summaryFor && <MarkSummarySaid week={hello.summaryFor} />}
          <TodayHome
            goal={first.goal}
            plan={first.plan}
            today={today}
            hour={now.getHours()}
            bowls={weekBowls(data.goals, data.entries, today)}
            welcome={welcome}
            back={back || visit.fromNudge}
            catchUp={catchUpLine(first.plan)}
            notice={calendarNotice(data.settings.calendarUntil, today)}
            next={next}
            goals={planned.map((item) => ({
              goal: item.goal,
              done:
                item.plan.status === "done" || item.plan.status === "complete",
            }))}
            onPick={(id) => {
              setFocusGoal(id);
              setPicked(id);
            }}
            corner={
              run > 0 ? (
                <StreakChip
                  days={run}
                  tip={streakTip({
                    goals: data.goals,
                    entries: data.entries,
                    today,
                    seen: data.settings.streakTipSeen,
                    days: run,
                  })}
                />
              ) : undefined
            }
            onStart={() => begin(first.goal)}
            onStartNext={() => next && begin(next)}
            cheer={undoable !== null}
            inSession={
              data.session?.goalId === first.goal.id &&
              sessionIsToday(data.session, today)
            }
            prompt={
              // Not while the goal is on a break: "no nudges" means no nudge question either (first-run check 2)
              showPrompt && first.plan.status !== "paused" ? (
                <NudgePrompt
                  compact
                  times={reminderTimes}
                  today={today}
                  onActed={() => setPromptPinned(true)}
                />
              ) : null
            }
          />
        </>
      )}

      {/* On the home view the week's shelf holds the foot of a phone screen, so the toast floats above it */}
      <Toast
        message={undoable?.message ?? null}
        onUndo={undoable?.undo ? undo : undefined}
        onClose={closeToast}
        raised={view === "home"}
      />
    </>
  );
}

/** Marks this week's "Last week: ..." summary as said once it is on Today, so it is said once a week. The visit's own
 *  snapshot keeps it on screen until the page is left. */
function MarkSummarySaid({ week }: { week: string }) {
  useEffect(() => updateSettings({ weekSummarySeenFor: week }), [week]);
  return null;
}
