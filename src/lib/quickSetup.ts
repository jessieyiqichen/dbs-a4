import { daysBetween } from "./dates";
import { amountTiers, dateOptions, perDayFor, splitAction, type DateOption } from "./onboarding";
import { STARTERS, type Site } from "./starters";
import type { GoalType } from "./types";
import { countError, MAX_TARGET, validateGoal, type GoalValues } from "./validate";

/** The one-screen first visit (user, 2026-10-18, after the teacher's "the page is the onboarding"): rows of one-tap
 *  choices, with today's number on the same screen. Nothing starts picked (teacher, 2026-10-28: the answers were chosen
 *  for you), so every row below begins empty. */
export interface Picks {
  /** A starter's key, or "own" for something of your own. */
  starter: string;
  ownText: string;
  /** "" until picked. */
  ownType: GoalType | "";
  /** A date option's key, "pick", or "" until picked. */
  when: string;
  pickedDate: string;
  /** 0 to 2 for Easy start, Steady, Go big, "own", or null until picked. */
  tier: number | "own" | null;
  ownAmount: string;
  /** A site's key for a goal that offers sites, "none", or "" until picked. */
  site: string;
}

/** One thing to do, with none of its rows answered yet. */
export function blankPicks(starter: string): Picks {
  return { starter, ownText: "", ownType: "", when: "", pickedDate: "", tier: null, ownAmount: "", site: "" };
}

/** Several things can be picked at once (teacher, 2026-10-28), each becoming its own goal: picking one adds it with
 *  nothing answered, picking it again takes it off, and the others keep their answers. */
export function toggleStarter(list: Picks[], key: string): Picks[] {
  return list.some((p) => p.starter === key) ? list.filter((p) => p.starter !== key) : [...list, blankPicks(key)];
}

const NO_SITE: Site = { key: "none", label: "No site", link: null };

export interface Tier {
  label: string;
  amount: number;
  /** null for a total until its date is known. */
  perDay: number | null;
}

export interface Resolved {
  /** null for a goal of your own until "How often?" is answered. */
  type: GoalType | null;
  /** "" for a daily goal. */
  deadline: string;
  dates: DateOption[];
  tiers: Tier[];
  /** Sites to pick from (job applications), with "No site" last; empty when the goal offers none. */
  sites: Site[];
  /** The key of the site in use, or "". */
  site: string;
  /** Today's number, once the picks make sense. */
  perDay: number | null;
  verb: string;
  unit: string;
  errors: { what?: string; often?: string; site?: string; when?: string; date?: string; amount?: string };
  /** The goal to save, or null while something is missing. */
  goal: GoalValues | null;
}

function checkWhat(text: string): string | undefined {
  if (!text.trim()) return 'Enter what you\'ll do, like "Send cold emails"';
  if (text.trim().length > 60) return "Keep it under 60 characters";
}

function checkDate(date: string, today: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Pick the date you want to finish by";
  if (date <= today) return "Pick a date after today";
}

/** A typed number, with an example the size of this goal's own middle choice. */
function checkAmount(text: string, example: number): string | undefined {
  const error = countError(text, example);
  if (error) return error;
  if (Number(text) > MAX_TARGET) return "Enter a number up to 100,000";
}

/** The finish date picked, "" until there is one. */
function deadlineFor(type: GoalType | null, picks: Picks, dates: DateOption[]): string {
  if (type !== "by-date") return "";
  if (picks.when === "pick") return picks.pickedDate;
  return dates.find((d) => d.key === picks.when)?.date ?? "";
}

export function resolveSetup(picks: Picks, today: string): Resolved {
  const starter = STARTERS.find((s) => s.key === picks.starter) ?? null;
  const type = starter ? starter.type : picks.ownType || null;
  const { verb, unit } = starter ? { verb: starter.verb, unit: starter.unit } : splitAction(picks.ownText);
  const dates = dateOptions(today);
  const deadline = deadlineFor(type, picks, dates);
  const sites = starter?.sites ? [...starter.sites, NO_SITE] : [];
  const site = sites.find((x) => x.key === picks.site) ?? null;

  const errors: Resolved["errors"] = {};
  if (!starter) errors.what = checkWhat(picks.ownText);
  if (!type) errors.often = "Pick how often";
  if (sites.length > 0 && !site) errors.site = "Pick where you apply, or No site";
  if (type === "by-date" && picks.when === "") errors.when = "Pick when you'll finish";
  if (type === "by-date" && picks.when === "pick") errors.date = checkDate(deadline, today);
  // A total's day's number needs its date; a daily goal's is the amount itself
  const dated = type === "daily" || (type === "by-date" && deadline !== "" && !errors.date);
  const days = type === "by-date" && dated ? daysBetween(today, deadline) + 1 : 1;
  const tiers = amountTiers(type ?? "daily", starter?.key ?? null, days).map((t) => ({
    ...t,
    perDay: type && dated ? perDayFor(type, t.amount, deadline, today) : null,
  }));
  if (picks.tier === null) errors.amount = "Pick how many";
  if (picks.tier === "own") errors.amount = checkAmount(picks.ownAmount, tiers[1].amount);
  const clean = Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as Resolved["errors"];

  const link = site ? site.link : (starter?.link ?? null);
  const amount = picks.tier === "own" ? Number(picks.ownAmount) : picks.tier === null ? 0 : tiers[picks.tier].amount;
  const ready = Object.keys(clean).length === 0 && type !== null;
  const goal = ready ? validateGoal({ verb, unit, type, target: String(amount), deadline, link: link ?? "" }, today).value : null;
  const perDay = goal && type ? perDayFor(type, amount, deadline, today) : null;
  return { type, deadline, dates, tiers, sites, site: site?.key ?? "", perDay, verb, unit, errors: clean, goal };
}
