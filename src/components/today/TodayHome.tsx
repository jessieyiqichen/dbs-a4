"use client";

import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ScreenHeading } from "@/components/ui/ScreenHeading";
import { breakTitle, levelFor, nudgeLine, sleepTalk } from "@/lib/nudges";
import { countOf, headline } from "@/lib/phrases";
import { breakOn, type TodayPlan } from "@/lib/quota";
import type { BowlDay } from "@/lib/scene";
import type { Goal } from "@/lib/types";
import type { CatEffect, CatMood } from "./CatArt";
import { Coins } from "./Coins";
import { Room } from "./Room";

interface Props {
  goal: Goal;
  plan: TodayPlan;
  today: string;
  hour: number;
  bowls: BowlDay[];
  /** The welcome-back line, shown in Titi's bubble instead of the nudge. */
  welcome: string | null;
  /** Back after days away, or here from a nudge: Titi is up and stretching instead of asleep, so the picture matches
   *  "You came back!" (user, 2026-10-19). */
  back?: boolean;
  /** Why today's number grew after missed days. */
  catchUp: string | null;
  /** The calendar file is running out. */
  notice: string | null;
  next: Goal | null;
  /** Every goal, for the switcher; the first is the one shown. */
  goals: { goal: Goal; done: boolean }[];
  onPick: (id: string) => void;
  corner?: React.ReactNode;
  onStart: () => void;
  onStartNext: () => void;
  /** Ends the goal's break today ("I'm back early"). */
  onResume: () => void;
  /** A session for this goal was opened today, even if nothing is logged yet: the button says "Keep going". */
  inSession?: boolean;
  /** True right after a log: Titi hops. */
  cheer?: boolean;
  /** "Nudge you tomorrow?", once something has been logged and reminders are not set up yet. */
  prompt?: React.ReactNode;
}

type Status = TodayPlan["status"];

function title(goal: Goal, plan: TodayPlan, today: string): string {
  switch (plan.status) {
    case "started":
      return `${plan.doneToday} done, ${plan.leftToday} to go!`;
    case "done":
      return "Done for today!";
    case "paused": {
      // Until when, so a break never reads as "done" (A3 review, 2026-10-26)
      const pause = breakOn(goal, today);
      return pause ? breakTitle(pause.to) : "On a break";
    }
    case "complete":
      return "Goal reached!";
    // Progress first, then the push to keep going: encouraging, not a verdict
    case "deadline-passed":
      return plan.doneTotal > 0
        ? `${plan.doneTotal} of ${goal.target}, nice work!`
        : "Ready for a fresh start?";
    default:
      return headline(goal.verb, plan.quota, goal.unit);
  }
}

/** Titi in every state, one pose per meaning (Fish Treat, TitiPoses): she hops after a log; stretches when you come back
 *  after days away or the date passed (a fresh start); sleeps before you start; taps a paw when a session is under way
 *  (Keep going); lies as a loaf when today is done or the goal is on a break; jumps when the goal is reached. */
function catFor(
  status: Status,
  cheer: boolean,
  back: boolean,
  greets: boolean,
): { mood: CatMood; effect?: CatEffect } {
  if (cheer) return { mood: "idle", effect: "hop" };
  if (status === "complete") return { mood: "celebrate", effect: "party" };
  if (status === "done" || status === "paused") return { mood: "loaf" };
  if (status === "deadline-passed") return { mood: "stretch" };
  // Before you start: back after days or from a reminder she stretches, a greeting ("Last week: ...", "Welcome back")
  // gets a wave, and otherwise she naps and talks in her sleep (user, 2026-10-19: every line on Today is hers, in her
  // bubble, and she sleeps until you start)
  if (status === "not-started")
    return back
      ? { mood: "stretch" }
      : greets
        ? { mood: "wave" }
        : { mood: "sleep", effect: "zzz" };
  if (status === "started") return { mood: "paw-tap" };
  return { mood: "idle" };
}

/** The whole goal in one quiet line; it opens the goal's progress page. */
function Road({ goal, plan }: { goal: Goal; plan: TodayPlan }) {
  const card =
    "clay clay-press flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 hover:bg-wash focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus";
  if (goal.type !== "by-date") {
    return (
      <Link
        href={`/goals/${goal.id}?from=today`}
        className={`${card} justify-center font-bold text-muted`}
      >
        {/* Says where it goes: Titi's diary of this goal (user, 2026-10-18: "N all time" did not say it opens a page) */}
        Titi&apos;s diary, {countOf(plan.doneTotal, goal.unit)} so far{" "}
        <span aria-hidden="true">→</span>
      </Link>
    );
  }
  const pct = Math.min(
    100,
    Math.round((plan.doneTotal / Math.max(goal.target, 1)) * 100),
  );
  return (
    <Link
      href={`/goals/${goal.id}?from=today`}
      className={card}
      aria-label={`See Titi's road: ${plan.doneTotal} of ${goal.target} done`}
    >
      <span className="font-display font-semibold text-ink">
        Road to {goal.target}
      </span>
      <div
        aria-hidden="true"
        className="h-3 flex-1 overflow-hidden rounded-full bg-wash-strong"
      >
        <div
          className="h-full rounded-full bg-reward shadow-[inset_0_2px_0_rgba(255,255,255,.5)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-extrabold tabular-nums text-muted">
        {plan.doneTotal} done
      </span>
    </Link>
  );
}

/** Which goal is up now: the person picks; the first tab is the one the app would pick on its own. */
function GoalTabs({
  goals,
  current,
  onPick,
}: {
  goals: { goal: Goal; done: boolean }[];
  current: string;
  onPick: (id: string) => void;
}) {
  const pill =
    "clay clay-press inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 font-display text-sm font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus";
  return (
    <nav
      aria-label="Up now"
      className="flex w-full gap-2 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible lg:pt-0"
    >
      {goals.map(({ goal, done }) => {
        const on = goal.id === current;
        // The goal shown now is a flat pale label, not a button: tapping it would do nothing, and it must not look like
        // the green main button (user, 2026-10-19). The other goals are buttons that switch to them.
        if (on)
          return (
            <span
              key={goal.id}
              aria-current="true"
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border-2 border-primary/50 bg-primary-soft px-4 font-display text-sm font-semibold text-ink"
            >
              {shortName(goal)}
              {done && <span aria-hidden="true">✓</span>}
              {done && <span className="sr-only">, done for today</span>}
            </span>
          );
        return (
          <button
            key={goal.id}
            type="button"
            onClick={() => onPick(goal.id)}
            className={`${pill} bg-surface text-ink hover:bg-wash`}
          >
            {shortName(goal)}
            {done && <span aria-hidden="true">✓</span>}
            {done && <span className="sr-only">, done for today</span>}
          </button>
        );
      })}
      <Link
        href="/goals/new"
        className={`${pill} bg-surface text-muted hover:bg-wash`}
      >
        + Add
      </Link>
    </nav>
  );
}

/** "Connection requests" for a tab, from what the goal counts. */
function shortName(goal: Goal): string {
  const unit = goal.unit.trim() || goal.title;
  return unit.charAt(0).toUpperCase() + unit.slice(1);
}

/** The sentence for today, with Titi's line under it; on a desktop it is a size larger and today's number shows as fish
 *  treats under it, all top-aligned (nothing stretched to match Titi's column). */
function SentenceCard({
  goal,
  plan,
  today,
  line,
  catchUp,
}: {
  goal: Goal;
  plan: TodayPlan;
  today: string;
  line: string | null;
  catchUp: string | null;
}) {
  const active = plan.status === "not-started" || plan.status === "started";
  return (
    <div className="relative w-full px-1 pt-1">
      <ScreenHeading
        id={`goal-${goal.id}`}
        className="font-display text-2xl font-bold leading-tight text-ink [text-wrap:balance] lg:text-5xl"
      >
        {title(goal, plan, today)}
      </ScreenHeading>
      {line && (
        <p className="mt-1 font-bold text-muted lg:mt-4 lg:text-lg">{line}</p>
      )}
      {catchUp && plan.status === "not-started" && (
        <p className="mt-1 text-sm font-bold text-muted">{catchUp}</p>
      )}
      {/* Desktop only: today's number as fish treats under the sentence, the same tiles the session uses */}
      {(active || plan.status === "done") && (
        <div className="mt-6 hidden lg:block">
          <Coins
            total={plan.quota}
            done={Math.min(plan.doneToday, plan.quota)}
            label="Today"
            size="lg"
          />
        </div>
      )}
    </div>
  );
}

/** The one button for today's state, then the whole goal's road in one quiet line. */
function MainAction({
  goal,
  plan,
  next,
  onStart,
  onStartNext,
  onResume,
  prompt,
  inSession = false,
}: {
  goal: Goal;
  plan: TodayPlan;
  next: Goal | null;
  onStart: () => void;
  onStartNext: () => void;
  onResume: () => void;
  prompt?: React.ReactNode;
  inSession?: boolean;
}) {
  const active = plan.status === "not-started" || plan.status === "started";
  return (
    <div className="flex w-full flex-col gap-3">
      {active && (
        <Button size="lg" onClick={onStart} className="w-full">
          {/* Back from the session without logging yet still says Keep going (user, 2026-10-19) */}
          {plan.status === "started" || inSession ? "Keep going" : "Start"}
        </Button>
      )}
      {plan.status === "done" && next && (
        <Button size="lg" onClick={onStartNext} className="w-full">
          Next: {next.title} →
        </Button>
      )}
      {plan.status === "complete" && (
        <ButtonLink href="/goals/new" size="lg" className="w-full">
          Set the next goal
        </ButtonLink>
      )}
      {plan.status === "deadline-passed" && (
        <ButtonLink
          href={`/goals/${goal.id}/edit`}
          size="lg"
          className="w-full"
        >
          Pick a new date
        </ButtonLink>
      )}
      {/* Ends the break here, rather than sending people to Goals to find Resume */}
      {plan.status === "paused" && (
        <Button variant="secondary" onClick={onResume} className="w-full">
          I&apos;m back early
        </Button>
      )}
      {/* Asked here, right under the button, as soon as one is logged: someone who does 2 of 5 and leaves is asked too
          (reviewer, user 2026-10-19), not only on the second celebration screen */}
      {prompt}
      <Road goal={goal} plan={plan} />
    </div>
  );
}

/** Today: the window, Titi on her mat, which goal, one sentence and one button; this week's bowls on a shelf that stays at
 *  the foot of a phone screen while the room scrolls. */
export function TodayHome({
  goal,
  plan,
  today,
  hour,
  bowls,
  welcome,
  back = false,
  catchUp,
  notice,
  next,
  goals,
  onPick,
  corner,
  onStart,
  onStartNext,
  onResume,
  cheer = false,
  prompt,
  inSession = false,
}: Props) {
  // Everything Titi says is in her bubble beside her: the welcome on the day's first open, otherwise the day's nudge,
  // and "so full" once today is done. The heading and the catch-up line stay under the tabs.
  const said =
    plan.status === "done"
      ? "Titi is so full! See you tomorrow"
      : (welcome ??
        (plan.status === "not-started" && !back
          ? sleepTalk(levelFor(hour))
          : nudgeLine(goal, plan, today, hour)));
  const cat = {
    ...catFor(plan.status, cheer, back, welcome !== null),
    key: cheer ? "cheer" : plan.status,
  };
  return (
    <section
      aria-labelledby={`goal-${goal.id}`}
      className="flex flex-col"
    >
      <Room bowls={bowls} cat={cat} corner={corner} say={said}>
        <GoalTabs goals={goals} current={goal.id} onPick={onPick} />
        <SentenceCard goal={goal} plan={plan} today={today} line={null} catchUp={catchUp} />
        <MainAction
          goal={goal}
          plan={plan}
          next={next}
          onStart={onStart}
          onStartNext={onStartNext}
          onResume={onResume}
          prompt={prompt}
          inSession={inSession}
        />
        {notice && (
          <Link
            href="/reminders"
            className="self-center text-sm font-bold text-muted underline decoration-2 underline-offset-4 hover:text-ink focus-visible:outline-3 focus-visible:outline-focus"
          >
            {notice}
          </Link>
        )}
      </Room>
    </section>
  );
}
