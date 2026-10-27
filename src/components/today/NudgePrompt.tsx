"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { updateSettings } from "@/lib/actions";
import { formatShortDate } from "@/lib/dates";
import { addToCalendar } from "@/lib/reminders";

/** Asked in place, only after something useful is done. The details live on the Reminders page. */
interface Props {
  times: string[];
  /** Called before an action, so the card stays open to show what happened. */
  onActed: () => void;
  /** Today's date: "Not now" hides the card for the rest of it. */
  today: string;
}

/** One row (the question, the calendar, Not now), on Today and on the celebration screen alike, so it never pushes the
 *  main button down (user, 2026-10-26: the bigger card on the celebration screen did). The calendar is the one action
 *  here: it reminds you even when Nudge is closed; notifications and the times are on the Reminders page. */
export function NudgePrompt({ times, onActed, today }: Props) {
  const [calendarUntil, setCalendarUntil] = useState<string | null>(null);
  const notNow = () => updateSettings({ nudgePromptSnoozedOn: today });

  return (
    <section
      aria-labelledby="nudge-prompt"
      className="flex flex-col gap-2 rounded-2xl bg-surface py-2 pl-4 pr-2 shadow-[0_2px_12px_rgba(61,59,51,.08)]"
    >
      <div className="flex items-center gap-2">
        <h2
          id="nudge-prompt"
          className="flex-1 font-display text-base font-semibold leading-tight text-ink"
        >
          Nudge you tomorrow?
        </h2>
        {!calendarUntil && (
          <Button
            variant="secondary"
            className="whitespace-nowrap"
            onClick={() => {
              onActed();
              setCalendarUntil(addToCalendar(times));
            }}
          >
            Get calendar file
          </Button>
        )}
        <Button variant="ghost" className="whitespace-nowrap px-2" onClick={notNow}>
          {calendarUntil ? "Done" : "Not now"}
        </Button>
      </div>
      <div role="status" className="flex flex-col gap-1 text-sm text-ink empty:hidden">
        {calendarUntil && (
          <p>
            Open the downloaded file to add it, it covers until{" "}
            {formatShortDate(calendarUntil)}
          </p>
        )}
      </div>
    </section>
  );
}
