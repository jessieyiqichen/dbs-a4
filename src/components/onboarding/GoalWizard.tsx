"use client";

import { useEffect, useRef, useState } from "react";
import { CatArt, type CatMood } from "@/components/today/CatArt";
import { Button } from "@/components/ui/Button";
import { ScreenHeading } from "@/components/ui/ScreenHeading";
import { addGoal } from "@/lib/actions";
import { SAVED_NOTE } from "@/lib/db/copy";
import { formatShortDate, toISODate } from "@/lib/dates";
import { countOf, headline } from "@/lib/phrases";
import { resolveSetup, toggleStarter, type Picks, type Resolved } from "@/lib/quickSetup";
import { startGoal } from "@/lib/start";
import { STARTERS } from "@/lib/starters";
import { Pills } from "./Pills";
import { BAR_VAR, firstMissing, scrollToField, SetupRows, type Set } from "./SetupRows";

interface Props {
  /** The very first visit: Titi waves and introduces herself, and the button says "my first one". */
  firstVisit?: boolean;
  /** Back to Goals (adding a goal later). */
  onCancel?: () => void;
  /** After the goal is saved and started. */
  onStarted?: () => void;
}

const WHAT = [
  ...STARTERS.map((s) => ({ value: s.key, label: s.label })),
  {
    value: "own",
    label: "Something else",
    hint: "Type your goal in the field below",
  },
];

/** How many of today's fish the first screen draws before it says "+N". */
const FISH_PREVIEW = 8;
const TIER_POSE: Record<string, CatMood> = {
  "0": "loaf",
  "1": "walk",
  "2": "celebrate",
  own: "paw-tap",
};
/** Titi's question. The first visit does not move focus, so it starts at the skip link as usual. On a desktop Titi stands
 *  in the right column above today's number (user, 2026-10-19: the right side was too short), so here the question is
 *  the page's plain heading. */
function Hello({ firstVisit, pose }: { firstVisit: boolean; pose: CatMood }) {
  const heading =
    "font-display text-xl font-semibold leading-snug text-ink lg:text-5xl lg:font-bold lg:leading-tight lg:[text-wrap:balance]";
  const question = firstVisit
    ? "Hi, I'm Titi! What have you been putting off?"
    : "What else have you been putting off?";
  return (
    <div className="flex items-end gap-2">
      <div className="shrink-0 lg:hidden">
        <CatArt
          key={pose}
          mood={pose}
          className={firstVisit ? "w-36" : "w-24"}
        />
      </div>
      <div className="flat bubble-phone-only mb-6 rounded-2xl rounded-bl-sm bg-surface px-4 py-3 lg:mb-0 lg:bg-transparent lg:p-0">
        {firstVisit ? (
          <h1 id="setup-title" className={heading}>
            {question}
          </h1>
        ) : (
          <ScreenHeading id="setup-title" className={heading}>
            {question}
          </ScreenHeading>
        )}
      </div>
    </div>
  );
}

/** What the bar says: what to answer next, or today's number for each goal once every row is answered. */
function resultLines(rs: Resolved[]): string[] {
  if (rs.length === 0) return ["Pick what you've been putting off to see today's number"];
  if (rs.some((r) => !r.goal || !r.perDay)) return ["Answer each row to see today's number"];
  return rs.map((r) => `${headline(r.verb, r.perDay ?? 0, r.unit)} today`);
}

/** Today's number in one sentence and the one button, updating with every tap. On a phone it stays pinned to the foot
 *  of the screen, so the number and Start are on the first screen whatever is picked above; on a desktop it is the
 *  right-hand column, with the whole goal and the note on where it is saved under it. With several goals, one line
 *  each. */
function Result({
  rs,
  firstVisit,
  onStart,
  pose,
}: {
  rs: Resolved[];
  firstVisit: boolean;
  onStart: () => void;
  pose: CatMood;
}) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const root = document.documentElement;
    const watch = new ResizeObserver(() =>
      root.style.setProperty(BAR_VAR, `${el.offsetHeight}px`),
    );
    watch.observe(el);
    return () => {
      watch.disconnect();
      root.style.removeProperty(BAR_VAR);
    };
  }, []);
  const lines = resultLines(rs);
  // The fish preview and the whole goal only for one goal: for several, the lines already fill the bar
  const r = rs.length === 1 ? rs[0] : null;
  const whole = r?.goal
    ? `${countOf(r.goal.target, r.goal.unit)} ${r.goal.deadline ? `by ${formatShortDate(r.goal.deadline)}` : "every day"}`
    : null;
  return (
    <div
      ref={bar}
      className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-hairline bg-page/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm lg:sticky lg:top-6 lg:col-span-5 lg:col-start-8 lg:inset-auto lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
    >
      <div className="mx-auto flex max-w-xl flex-col gap-2 lg:gap-3">
        <div className="hidden lg:mb-2 lg:flex lg:justify-center">
          <CatArt key={pose} mood={pose} className="w-56" />
        </div>
        <div aria-live="polite" className={`flex flex-col gap-1 font-display font-bold leading-tight text-ink [text-wrap:balance] ${lines.length > 1 ? "text-xl lg:text-3xl" : "text-2xl lg:text-4xl"}`}>
          {lines.map((line, i) => <p key={i}>{line}</p>)}
        </div>
        {/* Today's fish, still to earn: what you are about to fill, before you start (user, 2026-10-19). Not on a short or
            compact phone, where the bar would cover too much of the choices */}
        {r?.goal && r.perDay && (
          <div
            aria-hidden="true"
            className="flex items-center gap-1 short:hidden compact:hidden"
          >
            {Array.from(
              { length: Math.min(r.perDay, FISH_PREVIEW) },
              (_, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- decorative preview of today's fish
                <img
                  key={i}
                  src="/cat/fish-locked.png"
                  alt=""
                  className="w-8 lg:w-10"
                />
              ),
            )}
            {r.perDay > FISH_PREVIEW && (
              <span className="font-display text-sm font-semibold text-muted">
                +{r.perDay - FISH_PREVIEW}
              </span>
            )}
          </div>
        )}
        {whole && (
          <p className="hidden text-sm font-bold text-muted lg:block">
            {whole}, you can change it anytime in Goals
          </p>
        )}
        <Button size="lg" className="w-full lg:mt-2" onClick={onStart}>
          {firstVisit ? "Start my first one" : "Start the first one"}
        </Button>
        <p className="text-center text-xs text-muted lg:text-left lg:text-sm">
          {SAVED_NOTE}
        </p>
      </div>
    </div>
  );
}

/** The first visit, and adding a goal later, on one screen (user, 2026-10-18, after the teacher's "the page is the
 *  onboarding"): Titi asks, you pick one or more things, each thing's rows of one-tap answers open as you answer them
 *  (nothing picked for you, teacher 2026-10-28), and today's number is right there with the button to start. On a desktop the answers sit on the left and today's number stays in view on the right. */
export function GoalWizard({ firstVisit = false, onCancel, onStarted }: Props) {
  const today = toISODate(new Date());
  // Nothing picked to begin with, and as many things as you like (teacher, 2026-10-28)
  const [goals, setGoals] = useState<Picks[]>([]);
  // Each failed Start counts up, so the effect below runs after that render, once the error is on the page: the whole
  // field and its error are scrolled above the pinned bar, not just the input (reviewer, 2026-10-19: the error was
  // half under the bar when the input was already in view and only it was considered)
  const [tries, setTries] = useState(0);
  const rs = goals.map((p) => resolveSetup(p, today));
  // Titi waves until you answer, then takes a pose for how much you picked: a loaf for an easy start, walking for
  // steady, jumping for going big, a tap of the paw for a number of your own (user, 2026-10-19: keep Titi on the first
  // screen, in different poses)
  const [touched, setTouched] = useState(false);
  const setFor =
    (starter: string): Set =>
    (p) => {
      setTouched(true);
      setGoals((prev) => prev.map((g) => (g.starter === starter ? { ...g, ...p } : g)));
    };
  const toggle = (key: string) => {
    setTouched(true);
    setGoals((prev) => toggleStarter(prev, key));
  };
  const pose: CatMood = !touched
    ? firstVisit
      ? "wave"
      : "idle"
    : (TIER_POSE[String(goals[0]?.tier)] ?? "idle");
  const missing =
    goals.length === 0
      ? "setup-what"
      : (goals.map((p, i) => firstMissing(p, rs[i])).find(Boolean) ?? null);
  useEffect(() => {
    if (tries === 0 || !missing) return;
    // A field is focused itself; a row of answers by its first answer
    const field = document.getElementById(missing);
    const target = field instanceof HTMLInputElement ? field : field?.querySelector("input");
    target?.focus({ preventScroll: true });
    scrollToField(field?.closest("[data-field]") ?? field);
    // Only a new attempt moves focus; typing a fix must not pull it around
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tries]);
  const start = () => {
    const ready = rs.flatMap((r) => (r.goal ? [r.goal] : []));
    if (missing || ready.length === 0) {
      setTries((n) => n + 1);
      return;
    }
    // Every goal is saved, and the first one picked starts
    const [first] = ready.map((goal) => addGoal(goal, today));
    startGoal(first);
    onStarted?.();
  };
  const heading = (p: Picks) =>
    goals.length < 2 ? null : p.starter === "own" ? p.ownText.trim() || "Something else" : (WHAT.find((w) => w.value === p.starter)?.label ?? null);
  return (
    <section
      aria-labelledby="setup-title"
      className="flex flex-col pb-[calc(var(--setup-bar,10rem)+1.5rem)] pt-1 lg:pt-0 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8 lg:pb-0"
    >
      <div className="flex flex-col gap-6 lg:col-span-7">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="-ml-1 min-h-11 self-start px-1 text-sm font-semibold text-muted underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-focus lg:-mb-4 lg:text-lg"
          >
            ← Goals
          </button>
        )}
        <Hello firstVisit={firstVisit} pose={pose} />
        {/* What Nudge does, said once on the first screen (first-run check: "nothing on the first screen says what Nudge
            does") */}
        {firstVisit && (
          <p className="-mt-3 font-bold text-muted lg:-mt-2 lg:text-lg">
            Pick one or more. Nudge breaks each into a few a day, and each one
            you do is a fish for Titi
          </p>
        )}
        {!firstVisit && (
          <p className="-mt-3 font-bold text-muted lg:-mt-2 lg:text-lg">Pick one or more</p>
        )}
        <Pills
          name="what"
          id="setup-what"
          legend="What have you been putting off? Pick one or more"
          hideLegend
          multiple
          options={WHAT}
          value={goals.map((g) => g.starter)}
          onChange={toggle}
          error={tries > 0 && goals.length === 0 ? "Pick at least one" : undefined}
        />
        {goals.map((p, i) => (
          <SetupRows
            key={p.starter}
            heading={heading(p)}
            picks={p}
            r={rs[i]}
            set={setFor(p.starter)}
            errors={tries > 0 ? rs[i].errors : {}}
            today={today}
          />
        ))}
      </div>
      <Result rs={rs} firstVisit={firstVisit} onStart={start} pose={pose} />
    </section>
  );
}
