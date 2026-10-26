"use client";

import { CatArt } from "@/components/today/CatArt";
import { ButtonLink } from "@/components/ui/Button";
import { StorageNotice } from "@/components/ui/StorageNotice";
import { formatShortDate, toISODate } from "@/lib/dates";
import { formatCount } from "@/lib/format";
import { planToday } from "@/lib/quota";
import { useStore } from "@/lib/store";
import { streak } from "@/lib/streak";
import type { Goal } from "@/lib/types";
import type { TodayPlan } from "@/lib/quota";
import { diaryWeeks, roadStory } from "@/lib/story";
import { paceLine } from "@/lib/progress";
import { PageHeader } from "@/components/ui/PageHeader";
import { Diary } from "./Diary";
import { Road } from "./Road";
import { GoalActions } from "./GoalActions";

/** Titi beside the big number: how far, or how many a day, and the pace for a by-date goal. */
function Headline({
  goal,
  plan,
  today,
}: {
  goal: Goal;
  plan: TodayPlan;
  today: string;
}) {
  const byDate = goal.type === "by-date";
  return (
    <div className="flex items-end gap-3 lg:col-start-2 lg:row-start-1">
      {/* One Titi per screen: a by-date goal has her on the road below, so the number stands on its own here */}
      {!byDate && (
        <CatArt
          mood={plan.status === "done" ? "loaf" : "idle"}
          className="w-24 shrink-0"
        />
      )}
      <div
        className={
          byDate
            ? "flex-1 px-1"
            : "flat mb-6 flex-1 rounded-2xl rounded-bl-sm bg-surface px-4 py-3"
        }
      >
        <p className="font-display text-3xl font-bold leading-tight text-ink tabular-nums">
          {byDate
            ? `${plan.doneTotal} of ${goal.target}`
            : `${formatCount(goal.target, goal.unit)} a day`}
        </p>
        {byDate && (
          <p className="mt-1 text-sm font-bold text-muted">
            {paceLine(goal, plan, today)}
          </p>
        )}
      </div>
    </div>
  );
}

/** One goal's story so far: the big number, the chart, the run of days, and what you can do with the goal.
 *  From 1024px the painted road or the diary takes the left two thirds, and the number, the run of days and the actions
 *  stand in a column on the right (Remove at its foot, level with the picture's bottom), so none of them is pushed below
 *  the picture. Below 1024px nothing changes. */
/** The page header: back to wherever you came from, the goal itself as the title, and one line on how to read the page
 *  (user, 2026-10-18: a page titled only "Progress" did not say what it was showing, and Back always went to Goals). */
function Header({
  title,
  intro,
  fromToday,
  embedded = false,
}: {
  title: string;
  intro?: string;
  fromToday: boolean;
  embedded?: boolean;
}) {
  // Beside the list on a desktop the list is the way back, so only a visit from Today keeps a back link
  const back = fromToday ? "/" : embedded ? null : "/goals";
  return (
    <PageHeader
      title={title}
      intro={intro}
      back={back}
      backLabel={fromToday ? "← Today" : "← Goals"}
      level={embedded ? "h2" : "h1"}
    />
  );
}

export function ProgressScreen({
  id,
  fromToday = false,
  embedded = false,
}: {
  id: string;
  fromToday?: boolean;
  /** Shown beside the goal list on a desktop: an h2, and one column, as the list takes the left side. */
  embedded?: boolean;
}) {
  const state = useStore();
  if (state === null)
    return <p className="pt-6 text-muted">Loading your progress…</p>;
  if (state.kind === "load-failed") return <StorageNotice state={state} />;

  const { data } = state;
  const goal = data.goals.find((g) => g.id === id);
  if (!goal) {
    return (
      <>
        <Header title="Progress" fromToday={fromToday} />
        <div className="mt-8 flex flex-col gap-4">
          <p className="text-lg font-bold text-ink">
            This goal isn&apos;t saved on this device, it may have been removed
          </p>
          <ButtonLink href="/goals" className="self-start">
            See your goals
          </ButtonLink>
        </div>
      </>
    );
  }

  const today = toISODate(new Date());
  const plan = planToday(goal, data.entries, today);
  const run = streak(goal, data.entries, today);
  const lastRest = run.restDays[0];
  const byDate = goal.type === "by-date";

  const days = run.days === 1 ? "1 day in a row" : `${run.days} days in a row`;
  if (embedded) {
    // Beside the goal list on a desktop: one column, all left-aligned, in reading order: the goal, one line of where it
    // stands, the picture across all eight columns, then what you can do with it in one row (reviewer's layout, user
    // 2026-10-19). No back link (Today is in the navigation). A daily goal has a small Titi by the line; a by-date goal
    // already has her on the road, and one Titi per screen.
    const where = byDate
      ? `${plan.doneTotal} of ${goal.target} · ${paceLine(goal, plan, today)}`
      : `${formatCount(goal.target, goal.unit)} a day`;
    return (
      <>
        <PageHeader title={goal.title} back={null} level="h2" />
        {/* A div, not a p: Titi's picture is a div, which a paragraph can't hold (React's hydration warning) */}
        <div className="mt-3 flex items-center gap-3 font-bold text-muted">
          {!byDate && (
            <CatArt
              mood={plan.status === "done" ? "loaf" : "idle"}
              className="w-16 shrink-0"
            />
          )}
          <span>
            {where} · {days}
            {lastRest &&
              ` · ${formatShortDate(lastRest)} was your free rest day, one a week`}
          </span>
        </div>
        <div className="mt-6">
          {byDate ? (
            <Road goal={goal} story={roadStory(goal, data.entries, today)} />
          ) : (
            <Diary
              weeks={diaryWeeks(goal, data.entries, today, 2)}
              target={goal.target}
              unit={goal.unit}
            />
          )}
        </div>
        <div className="mt-8 lg:mt-auto lg:pt-8">
          <GoalActions goal={goal} today={today} inline />
        </div>
      </>
    );
  }

  const intro = byDate
    ? `Titi walks the road as you go: a sign every quarter, the flag on ${formatShortDate(goal.deadline ?? today)}`
    : "Your last two weeks, one bowl a day";
  return (
    <>
      <Header
        title={goal.title}
        intro={intro}
        fromToday={fromToday}
        embedded={embedded}
      />
      {/* Beside the goal list the picture and the side column share the eight columns (2:1), so the goal is not one long
          column next to a short list (user, 2026-10-19: the two sides were unbalanced) */}
      <div
        className={`mt-6 flex flex-col gap-7 lg:grid lg:grid-rows-[auto_auto_1fr] lg:gap-y-5 ${embedded ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-x-8" : "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-x-12"}`}
      >
        <Headline goal={goal} plan={plan} today={today} />

        <div className="lg:col-start-1 lg:row-span-3 lg:row-start-1">
          {byDate ? (
            <Road goal={goal} story={roadStory(goal, data.entries, today)} />
          ) : (
            <Diary
              weeks={diaryWeeks(goal, data.entries, today, 2)}
              target={goal.target}
              unit={goal.unit}
            />
          )}
        </div>

        {/* Plain text, not a clay surface: chunky clay is kept for things you can tap */}
        <p className="px-1 font-display font-semibold text-ink lg:col-start-2 lg:row-start-2">
          {run.days === 1 ? "1 day in a row" : `${run.days} days in a row`}
          {lastRest && (
            <span className="font-sans text-sm font-bold text-muted">
              {" "}
              · {formatShortDate(lastRest)} was your free rest day, one a week
            </span>
          )}
        </p>

        <div className="lg:col-start-2 lg:row-start-3">
          <GoalActions goal={goal} today={today} />
        </div>
      </div>
    </>
  );
}
