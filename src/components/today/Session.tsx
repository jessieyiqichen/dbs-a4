"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { ScreenHeading } from "@/components/ui/ScreenHeading";
import { didOne, headline, quickAmounts } from "@/lib/phrases";
import { sessionLine } from "@/lib/session";
import { siteName } from "@/lib/start";
import type { Goal } from "@/lib/types";
import { parseCount } from "@/lib/validate";
import type { SavedJob } from "@/lib/jobs/saved";
import { CatArt } from "./CatArt";
import { Coins } from "./Coins";
import { SessionSaved } from "./SessionSaved";

interface Props {
  goal: Goal;
  total: number;
  done: number;
  /** Nothing was ever logged: Titi says how, once. */
  firstTime?: boolean;
  onLog: (amount: number) => void;
  onOpen: () => void;
  /** An applications goal's saved jobs still to apply to; null for other goals (no list) */
  saved?: SavedJob[] | null;
  onApplied?: (job: SavedJob) => void;
}

/** Any number typed: one labelled field; the typed number stays on an error and focus returns to it. */
function MoreForm({
  onLog,
  label = "Or type a number",
}: {
  onLog: (n: number) => void;
  label?: string;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const ref = useRef<HTMLInputElement>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseCount(text);
    if (!parsed.ok) {
      setError(parsed.error);
      ref.current?.focus();
      return;
    }
    onLog(parsed.value);
    setText("");
  }
  return (
    <form onSubmit={submit} noValidate className="mt-4 flex items-end gap-3">
      <Field id={id} label={label} error={error}>
        {(control) => (
          <TextInput
            {...control}
            ref={ref}
            inputMode="numeric"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-28"
          />
        )}
      </Field>
      <Button type="submit" variant="secondary" className={error ? "mb-7" : ""}>
        Add
      </Button>
    </form>
  );
}

/** The way back: the same back link as every other page under Today; the session is kept, so Today says "Keep going". */
function SessionBar() {
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 self-start items-center text-sm font-semibold text-muted underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-focus lg:text-lg"
    >
      ← Today
    </Link>
  );
}

/** Several done at once: a few quick amounts up to what is left, or any number typed. */
function Batch({
  total,
  done,
  log,
}: {
  total: number;
  done: number;
  log: (n: number) => void;
}) {
  const left = Math.max(total - done, 0);
  const quick = quickAmounts(left).filter((n) => n > 1);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  // It replaces the button that opened it, so focus moves to its first choice instead of falling to the page.
  useEffect(
    () => box.current?.querySelector<HTMLElement>("button, input")?.focus(),
    [],
  );
  return (
    <div ref={box} className="mt-4 flex flex-col gap-3">
      {/* With nothing to offer as a quick number (one left), the field asks the question itself, so "Or" never points
          at choices that are not there (first-run check 2) */}
      {quick.length > 0 && (
        <p
          id={`${id}-several`}
          className="font-display text-lg font-semibold text-ink"
        >
          How many did you do?
        </p>
      )}
      {quick.length > 0 && (
        <div
          role="group"
          aria-labelledby={`${id}-several`}
          className="flex flex-wrap gap-2"
        >
          {quick.map((n) => (
            <Button
              key={n}
              variant="secondary"
              className="min-w-16"
              onClick={() => log(n)}
            >
              {n === left ? `All ${n}` : `+${n}`}
            </Button>
          ))}
        </div>
      )}
      <MoreForm
        onLog={log}
        label={quick.length > 0 ? "Or type a number" : "How many did you do?"}
      />
    </div>
  );
}

/** Everything to tap in a session, in the order of the work: open the site, then one button that says what you did
 *  ("I sent one", a fish on it) and logs one, and "Did several at once?" for a batch (user, 2026-10-18: one way to log
 *  one, and a faster way for several). The fish above only show how far today has come.
 *  The green button is whichever comes next (reviewer, user 2026-10-19): before anything is done and the site is not
 *  open yet, that is "Open LinkedIn"; once it has been opened, or one is logged, it is "I sent one". The order on the
 *  page stays the same, only the emphasis moves. A goal with no site has "I sent one" as its only main button. */
function LogPanel({
  goal,
  total,
  done,
  log,
  onOpen,
}: {
  goal: Goal;
  total: number;
  done: number;
  log: (n: number) => void;
  onOpen: () => void;
}) {
  const [several, setSeveral] = useState(false);
  const [opened, setOpened] = useState(false);
  const site = siteName(goal.link);
  const openFirst = Boolean(site) && done === 0 && !opened;
  return (
    <div className="flex flex-col lg:col-span-7 lg:col-start-1 lg:row-start-2 lg:max-w-xl lg:self-start">
      <div className="mt-6 lg:mt-0">
        <Coins total={total} done={done} label="Today" size="lg" />
      </div>
      {site && (
        <Button
          variant={openFirst ? "primary" : "secondary"}
          size="lg"
          className="mt-6 w-full"
          onClick={() => {
            setOpened(true);
            onOpen();
          }}
        >
          Open {site} <span aria-hidden="true">↗</span>
          <span className="sr-only">(opens in a new tab)</span>
        </Button>
      )}
      <Button
        variant={openFirst ? "secondary" : "primary"}
        size="lg"
        className={`${site ? "mt-3" : "mt-6"} w-full`}
        onClick={() => log(1)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- the fish treat this button earns */}
        <img src="/cat/fish.png" alt="" aria-hidden="true" className="w-8" />
        {didOne(goal.verb)}
      </Button>
      {several ? (
        <Batch total={total} done={done} log={log} />
      ) : (
        <Button
          variant="ghost"
          className="mt-4 self-start"
          onClick={() => setSeveral(true)}
        >
          Did several at once?
        </Button>
      )}
    </div>
  );
}

/** Working through today's number, like a lesson: today's task as the heading, Titi cheering in her bubble, a row of
 *  fish that fills as you log ("2 of 5 done" under it), and one button that logs one. No bowl (one picture of
 *  progress); Titi hops with hearts on every log. The session ends on its own when today is done. */
export function Session({
  goal,
  total,
  done,
  firstTime = false,
  onLog,
  onOpen,
  saved = null,
  onApplied,
}: Props) {
  const id = useId();
  const [flight, setFlight] = useState<{ key: number; amount: number } | null>(
    null,
  );
  const log = (amount: number) => {
    setFlight({ key: (flight?.key ?? 0) + 1, amount });
    onLog(amount);
  };

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col pt-1 lg:pt-0"
    >
      <SessionBar />
      {/* On a desktop the same grid as Today (task first): the task, the fish and the buttons on the left seven columns,
          Titi and her bubble on the right five. The right column is as tall as the left, her bubble level with the
          heading and her feet level with the last button (user, 2026-10-19: the two sides must line up) */}
      <div className="contents lg:mt-2 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8">
        <ScreenHeading
          id={`${id}-title`}
          className="mt-2 font-display text-3xl font-bold leading-tight text-ink [text-wrap:balance] lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:mb-8 lg:mt-0 lg:text-5xl"
        >
          {headline(goal.verb, total, goal.unit)} today
        </ScreenHeading>
        <div className="flex flex-col lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:self-stretch">
          <div className="mt-4 flex items-end gap-2 lg:mt-0 lg:h-full lg:flex-col-reverse lg:items-center lg:justify-between lg:gap-4">
            <CatArt
              key={flight?.key ?? 0}
              mood="idle"
              effect={flight ? "hop" : undefined}
              className="w-36 shrink-0 lg:w-80"
            />
            <div className="flat mb-8 rounded-2xl rounded-bl-sm bg-surface px-4 py-3 lg:mb-0 lg:self-stretch lg:rounded-bl-2xl lg:text-center">
              <p
                aria-live="polite"
                className="font-display text-xl font-semibold leading-snug text-ink lg:text-2xl"
              >
                {sessionLine(done, total, firstTime)}
              </p>
            </div>
          </div>
        </div>
        <LogPanel
          goal={goal}
          total={total}
          done={done}
          log={log}
          onOpen={onOpen}
        />
        {saved && onApplied && (
          <div className="flex flex-col lg:col-span-7 lg:col-start-1 lg:row-start-3 lg:max-w-xl">
            <SessionSaved
              jobs={saved}
              onApplied={(job) => {
                // Titi hops for it like for any one done
                setFlight({ key: (flight?.key ?? 0) + 1, amount: 1 });
                onApplied(job);
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
