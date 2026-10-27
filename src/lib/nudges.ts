import { daysBetween, formatShortDate } from "./dates";
import { formatCount } from "./format";
import type { TodayPlan } from "./quota";
import type { Goal, Settings } from "./types";

export type NudgeLevel = "gentle" | "firmer" | "last-call";

/** A cheerleader's voice, after Duolingo: short, warm, never shaming, eight words at most, and never a full stop
 *  (house style: "!" when it cheers, "" when it's easygoing). Lines rotate by day. */
const NOT_STARTED: Record<NudgeLevel, string[]> = {
  gentle: [
    "Just one to start today!",
    "One counts, let's go",
    "Small start, big day!",
    "Open it and do one",
  ],
  firmer: [
    "Still time! Just one",
    "One now keeps your streak going!",
    "You've got this, start with one!",
    "Future you says thanks",
  ],
  "last-call": [
    "There's still time for one!",
    "One before bed? You've got it",
    "Late, but one still counts!",
  ],
};

// The headline already says how many are done and left, so these only cheer.
const STARTED = ["Nice! Keep it rolling", "You're on a roll!", "Look at you go!"];

const DONE = ["You showed up again!", "That's how big goals happen", "Be proud of today!"];

export function levelFor(hour: number): NudgeLevel {
  if (hour >= 19) return "last-call";
  if (hour >= 14) return "firmer";
  return "gentle";
}

function pick(lines: string[], goal: Goal, today: string): string {
  const seed = [...goal.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return lines[(daysBetween("2026-01-01", today) + seed) % lines.length];
}

/** A goal on a break, on Today: the sentence says until when, so it never reads as "done" (A3 review, 2026-10-26). */
export const breakTitle = (to: string) => `On a break until ${formatShortDate(to)}`;
/** The same break on the goal's card in the Goals list. */
export const breakBack = (to: string) => `Back ${formatShortDate(to)}`;

export function nudgeLine(goal: Goal, plan: TodayPlan, today: string, hour: number): string {
  switch (plan.status) {
    case "complete":
      return `You did it, ${formatCount(goal.target, goal.unit)}!`;
    case "deadline-passed":
      return "The date passed, pick a new one and keep going!";
    // The sentence under Titi already says until when (A3 review: a break needs a clearer signal)
    case "paused":
      return "Titi is napping too, see you then";
    case "done":
      return pick(DONE, goal, today);
    case "started":
      return pick(STARTED, goal, today);
    default:
      return pick(NOT_STARTED[levelFor(hour)], goal, today);
  }
}

/** A not-started line for a calendar reminder, which can't know what has been done. */
export function calendarLine(date: string, hour: number): string {
  const lines = NOT_STARTED[levelFor(hour)];
  return lines[(daysBetween("2026-01-01", date) + hour) % lines.length];
}

/** Whether to ask "Nudge you tomorrow?": once something has been logged (on Today too, not only after a finished day,
 *  so someone who does 2 of 5 is asked), while reminders are not set up, and not again on a day "Not now" was tapped.
 *  `pinned` keeps it open after an action so it can show what happened. */
export function showNudgePrompt(
  settings: Pick<Settings, "nudgesSetUp" | "nudgePromptSnoozedOn">,
  today: string,
  { logged, pinned }: { logged: boolean; pinned: boolean },
): boolean {
  if (pinned) return true;
  if (!logged || settings.nudgesSetUp) return false;
  return settings.nudgePromptSnoozedOn !== today;
}

const SLEEP_TALK: Record<NudgeLevel, string> = {
  gentle: "Zzz… one fish would wake me up",
  firmer: "Zzz… is it fish time yet?",
  "last-call": "Zzz… one fish before bed?",
};

/** What Titi mumbles in her sleep before you start today: still a nudge, said as a dream about fish, a little more
 *  pointed as the day goes on (user, 2026-10-19: she naps until you start, and talks in her sleep). */
export function sleepTalk(level: NudgeLevel): string {
  return SLEEP_TALK[level];
}
