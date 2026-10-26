"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CatArt, type CatMood } from "@/components/today/CatArt";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { ScreenHeading } from "@/components/ui/ScreenHeading";
import { addGoal } from "@/lib/actions";
import { SAVED_NOTE } from "@/lib/db/copy";
import { addDays, formatShortDate, toISODate } from "@/lib/dates";
import { countOf, headline } from "@/lib/phrases";
import {
  FIRST_PICKS,
  resolveSetup,
  type Picks,
  type Resolved,
} from "@/lib/quickSetup";
import { startGoal } from "@/lib/start";
import { STARTERS } from "@/lib/starters";
import { Pills } from "./Pills";

interface Props {
  /** The very first visit: Titi waves and introduces herself, and the button says "my first one". */
  firstVisit?: boolean;
  /** Back to Goals (adding a goal later). */
  onCancel?: () => void;
  /** After the goal is saved and started. */
  onStarted?: () => void;
}

type Set = (p: Partial<Picks>) => void;

const WHAT = [
  ...STARTERS.map((s) => ({ value: s.key, label: s.label })),
  {
    value: "own",
    label: "Something else",
    hint: "Type your goal in the field below",
  },
];

/** On a phone the result bar is pinned over the foot of the screen; its height is kept here so the page can leave room
 *  for it and a field scrolled into view stops above it (reviewer, 2026-10-18: an error sat under the bar). */
const BAR_VAR = "--setup-bar";
const ROOM = "scroll-mb-[calc(var(--setup-bar,10rem)+1rem)] lg:scroll-mb-4";

function scrollToField(el: Element | null) {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el?.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
}

/** A field that appears after a choice (My own, Pick a date, Something else): it scrolls itself into view above the
 *  bar, while focus stays on the choice, so arrowing through the choices never pulls the keyboard out of them. */
function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => scrollToField(ref.current), []);
  return (
    <div ref={ref} data-field className={ROOM}>
      {children}
    </div>
  );
}
/** How many of today's fish the first screen draws before it says "+N". */
const FISH_PREVIEW = 8;
const TIER_POSE: Record<string, CatMood> = {
  "0": "loaf",
  "1": "walk",
  "2": "celebrate",
  own: "paw-tap",
};
const OFTEN = [
  { value: "daily", label: "Every day" },
  { value: "by-date", label: "A total by a date" },
];

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

/** Today's number in one sentence and the one button, updating with every tap. On a phone it stays pinned to the foot
 *  of the screen, so the number and Start are on the first screen whatever is picked above; on a desktop it is the
 *  right-hand column, with the whole goal and the note on where it is saved under it. */
function Result({
  r,
  firstVisit,
  onStart,
  pose,
}: {
  r: Resolved;
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
  const line =
    r.goal && r.perDay
      ? `${headline(r.verb, r.perDay, r.unit)} today`
      : "Tell Titi a little more to see today's number";
  const whole = r.goal
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
        <p
          aria-live="polite"
          className="font-display text-2xl font-bold leading-tight text-ink [text-wrap:balance] lg:text-4xl"
        >
          {line}
        </p>
        {/* Today's fish, still to earn: what you are about to fill, before you start (user, 2026-10-19). Not on a short
            phone, where the bar would cover too much of the choices */}
        {r.goal && r.perDay && (
          <div
            aria-hidden="true"
            className="flex items-center gap-1 short:hidden"
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

/** Where job applications are made: a few recruiting sites, or none; the session's "Open" button goes there. */
function Where({ r, set }: { r: Resolved; set: Set }) {
  const options = r.sites.map((x) => ({ value: x.key, label: x.label }));
  return (
    <Pills
      name="site"
      legend="Where do you apply?"
      options={options}
      value={r.site}
      onChange={(v) => set({ site: v })}
    />
  );
}

/** The goal's own words and how often, when it is something else. */
function OwnGoal({
  picks,
  set,
  error,
}: {
  picks: Picks;
  set: Set;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Reveal>
        <Field
          id="setup-what"
          label="What will you do?"
          hint='Like "Send cold emails" or "Practice LeetCode problems"'
          error={error}
        >
          {(c) => (
            <TextInput
              {...c}
              value={picks.ownText}
              autoComplete="off"
              onChange={(e) => set({ ownText: e.target.value })}
            />
          )}
        </Field>
      </Reveal>
      <Pills
        name="often"
        legend="How often?"
        options={OFTEN}
        value={picks.ownType}
        onChange={(v) => set({ ownType: v as Picks["ownType"] })}
      />
    </div>
  );
}

/** Finish by: two weeks, a month, Thanksgiving, or a date you pick. */
function When({
  picks,
  r,
  set,
  today,
  error,
}: {
  picks: Picks;
  r: Resolved;
  set: Set;
  today: string;
  error?: string;
}) {
  const options = [
    ...r.dates.map((d) => ({
      value: d.key,
      label: d.label,
      detail: formatShortDate(d.date),
    })),
    {
      value: "pick",
      label: "Pick a date",
      hint: "Pick the date in the field below",
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      <Pills
        name="when"
        legend="By when?"
        options={options}
        value={picks.when}
        onChange={(v) => set({ when: v })}
      />
      {picks.when === "pick" && (
        <Reveal>
          <Field id="setup-date" label="Finish by" error={error}>
            {(c) => (
              <TextInput
                {...c}
                type="date"
                min={addDays(today, 1)}
                value={picks.pickedDate}
                onChange={(e) => set({ pickedDate: e.target.value })}
                className="w-48"
              />
            )}
          </Field>
        </Reveal>
      )}
    </div>
  );
}

/** How many: three suggestions, a by-date total showing its day's number too, or a number of your own. */
function HowMany({
  picks,
  r,
  set,
  error,
}: {
  picks: Picks;
  r: Resolved;
  set: Set;
  error?: string;
}) {
  const daily = r.type === "daily";
  const tiers = r.tiers.map((t, i) => ({
    value: String(i),
    label: `${t.label}, ${t.amount}`,
    detail: daily ? undefined : `${t.perDay} a day`,
  }));
  return (
    <div className="flex flex-col gap-3">
      <Pills
        name="tier"
        legend={
          daily
            ? `How many ${r.unit || "times"} a day?`
            : `How many ${r.unit || "times"} in total?`
        }
        options={[
          ...tiers,
          {
            value: "own",
            label: "My own",
            hint: "Type your number in the field below",
          },
        ]}
        value={String(picks.tier)}
        onChange={(v) => set({ tier: v === "own" ? "own" : Number(v) })}
      />
      {picks.tier === "own" && (
        <Reveal>
          <Field
            id="setup-amount"
            label={daily ? "How many each day?" : "How many in total?"}
            error={error}
          >
            {(c) => (
              <TextInput
                {...c}
                inputMode="numeric"
                autoComplete="off"
                value={picks.ownAmount}
                onChange={(e) => set({ ownAmount: e.target.value })}
                className="w-32"
              />
            )}
          </Field>
        </Reveal>
      )}
    </div>
  );
}

/** The first visit, and adding a goal later, on one screen (user, 2026-10-18, after the teacher's "the page is the
 *  onboarding"): Titi asks, three rows of one-tap answers come already picked, and today's number is right there with
 *  the button to start. On a desktop the answers sit on the left and today's number stays in view on the right. */
export function GoalWizard({ firstVisit = false, onCancel, onStarted }: Props) {
  const today = toISODate(new Date());
  const [picks, setPicks] = useState<Picks>(FIRST_PICKS);
  // Each failed Start counts up, so the effect below runs after that render, once the error is on the page: the whole
  // field and its error are scrolled above the pinned bar, not just the input (reviewer, 2026-10-19: the error was
  // half under the bar when the input was already in view and only it was considered)
  const [tries, setTries] = useState(0);
  const r = resolveSetup(picks, today);
  const errors = tries > 0 ? r.errors : {};
  // Titi waves until you answer, then takes a pose for how much you picked: a loaf for an easy start, walking for
  // steady, jumping for going big, a tap of the paw for a number of your own (user, 2026-10-19: keep Titi on the first
  // screen, in different poses)
  const [touched, setTouched] = useState(false);
  const set: Set = (p) => {
    setTouched(true);
    setPicks((prev) => ({ ...prev, ...p }));
  };
  const pose: CatMood = !touched
    ? firstVisit
      ? "wave"
      : "idle"
    : (TIER_POSE[String(picks.tier)] ?? "idle");
  const firstError = r.errors.what
    ? "setup-what"
    : r.errors.date
      ? "setup-date"
      : r.errors.amount
        ? "setup-amount"
        : null;
  useEffect(() => {
    if (tries === 0 || !firstError) return;
    const field = document.getElementById(firstError);
    field?.focus({ preventScroll: true });
    scrollToField(field?.closest("[data-field]") ?? field);
    // Only a new attempt moves focus; typing a fix must not pull it around
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tries]);
  const start = () => {
    if (!r.goal) {
      setTries((n) => n + 1);
      return;
    }
    startGoal(addGoal(r.goal, today));
    onStarted?.();
  };
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
            Pick one thing. Nudge breaks it into a few a day, and each one you
            do is a fish for Titi
          </p>
        )}
        <Pills
          name="what"
          legend="What have you been putting off?"
          hideLegend
          options={WHAT}
          value={picks.starter}
          onChange={(v) => set({ starter: v })}
        />
        {picks.starter === "own" && (
          <OwnGoal picks={picks} set={set} error={errors.what} />
        )}
        {r.sites.length > 0 && <Where r={r} set={set} />}
        {r.type === "by-date" && (
          <When
            picks={picks}
            r={r}
            set={set}
            today={today}
            error={errors.date}
          />
        )}
        <HowMany picks={picks} r={r} set={set} error={errors.amount} />
      </div>
      <Result r={r} firstVisit={firstVisit} onStart={start} pose={pose} />
    </section>
  );
}
