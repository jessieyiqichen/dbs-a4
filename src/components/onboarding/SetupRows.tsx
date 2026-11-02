"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Field, TextInput } from "@/components/ui/Field";
import { addDays, formatShortDate } from "@/lib/dates";
import type { Picks, Resolved } from "@/lib/quickSetup";
import { Pills } from "./Pills";

export type Set = (p: Partial<Picks>) => void;

/** On a phone the result bar is pinned over the foot of the screen; its height is kept here so the page can leave room
 *  for it and a field scrolled into view stops above it (reviewer, 2026-10-18: an error sat under the bar). */
export const BAR_VAR = "--setup-bar";
const ROOM = "scroll-mb-[calc(var(--setup-bar,10rem)+1rem)] lg:scroll-mb-4";

export function scrollToField(el: Element | null) {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el?.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
}

/** The id of a row or field in one goal's part of the screen; several goals can be set up at once. */
export const rowId = (row: string, starter: string) => `setup-${row}-${starter}`;

/** Where to send someone who pressed Start too early: the first row in this goal still to answer, in screen order. */
export function firstMissing(picks: Picks, r: Resolved): string | null {
  const e = r.errors;
  if (e.what) return rowId("what", picks.starter);
  if (e.often) return rowId("often", picks.starter);
  if (e.site) return rowId("site", picks.starter);
  if (e.when) return rowId("when", picks.starter);
  if (e.date) return rowId("date", picks.starter);
  if (e.amount) return rowId(picks.tier === "own" ? "amount" : "tier", picks.starter);
  return null;
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

const OFTEN = [
  { value: "daily", label: "Every day" },
  { value: "by-date", label: "A total by a date" },
];

interface RowProps {
  picks: Picks;
  r: Resolved;
  set: Set;
  errors: Resolved["errors"];
}

/** Where job applications are made: a few recruiting sites, or none; the session's "Open" button goes there. */
function Where({ picks, r, set, errors }: RowProps) {
  const options = r.sites.map((x) => ({ value: x.key, label: x.label }));
  return (
    <Pills
      name={`site-${picks.starter}`}
      id={rowId("site", picks.starter)}
      legend="Where do you apply?"
      options={options}
      value={r.site}
      onChange={(v) => set({ site: v })}
      error={errors.site}
    />
  );
}

/** The goal's own words and how often, when it is something else. */
function OwnGoal({ picks, set, errors }: RowProps) {
  return (
    <div className="flex flex-col gap-4">
      <Reveal>
        <Field
          id={rowId("what", picks.starter)}
          label="What will you do?"
          hint='Like "Send cold emails" or "Practice LeetCode problems"'
          error={errors.what}
        >
          {(c) => (
            <TextInput {...c} value={picks.ownText} autoComplete="off" onChange={(e) => set({ ownText: e.target.value })} />
          )}
        </Field>
      </Reveal>
      <Pills
        name={`often-${picks.starter}`}
        id={rowId("often", picks.starter)}
        legend="How often?"
        options={OFTEN}
        value={picks.ownType}
        onChange={(v) => set({ ownType: v as Picks["ownType"] })}
        error={errors.often}
      />
    </div>
  );
}

/** Finish by: two weeks, a month, Thanksgiving, or a date you pick. */
function When({ picks, r, set, errors, today }: RowProps & { today: string }) {
  const options = [
    ...r.dates.map((d) => ({ value: d.key, label: d.label, detail: formatShortDate(d.date) })),
    { value: "pick", label: "Pick a date", hint: "Pick the date in the field below" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <Pills
        name={`when-${picks.starter}`}
        id={rowId("when", picks.starter)}
        legend="By when?"
        options={options}
        value={picks.when}
        onChange={(v) => set({ when: v })}
        error={errors.when}
      />
      {picks.when === "pick" && (
        <Reveal>
          <Field id={rowId("date", picks.starter)} label="Finish by" error={errors.date}>
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
function HowMany({ picks, r, set, errors }: RowProps) {
  const daily = r.type === "daily";
  const tiers = r.tiers.map((t, i) => ({
    value: String(i),
    label: `${t.label}, ${t.amount}`,
    detail: daily || t.perDay === null ? undefined : `${t.perDay} a day`,
  }));
  return (
    <div className="flex flex-col gap-3">
      <Pills
        name={`tier-${picks.starter}`}
        id={rowId("tier", picks.starter)}
        legend={daily ? `How many ${r.unit || "times"} a day?` : `How many ${r.unit || "times"} in total?`}
        options={[...tiers, { value: "own", label: "My own", hint: "Type your number in the field below" }]}
        value={picks.tier === null ? "" : String(picks.tier)}
        onChange={(v) => set({ tier: v === "own" ? "own" : Number(v) })}
        error={picks.tier === null ? errors.amount : undefined}
      />
      {picks.tier === "own" && (
        <Reveal>
          <Field
            id={rowId("amount", picks.starter)}
            label={daily ? "How many each day?" : "How many in total?"}
            error={errors.amount}
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

/** One goal's rows, each shown once the one before it is answered, so the screen asks one thing at a time instead of
 *  answering for you (teacher, 2026-10-28). With several goals picked, each part is headed by its name. */
export function SetupRows({ heading, today, ...row }: RowProps & { today: string; heading: string | null }) {
  const { picks, r } = row;
  const siteAnswered = r.sites.length === 0 || r.site !== "";
  // How many waits for the date: a total's day's number depends on it
  const showHowMany = r.type !== null && siteAnswered && r.tiers[0]?.perDay !== null;
  return (
    <div className="flex flex-col gap-6">
      {heading && (
        <p className="border-t-2 border-hairline pt-5 font-display text-xl font-bold text-ink lg:text-2xl">{heading}</p>
      )}
      {picks.starter === "own" && <OwnGoal {...row} />}
      {r.sites.length > 0 && <Where {...row} />}
      {r.type === "by-date" && <When {...row} today={today} />}
      {showHowMany && <HowMany {...row} />}
    </div>
  );
}
