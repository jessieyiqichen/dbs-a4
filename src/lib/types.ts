export type GoalType = "by-date" | "daily";

/** A stretch of days (inclusive, YYYY-MM-DD) when a goal is paused. */
export interface Pause {
  from: string;
  to: string;
}

export interface GoalPast {
  /** The last day these values applied. */
  to: string;
  target: number;
  type: GoalType;
  deadline: string | null;
}

export interface Goal {
  id: string;
  /** Capitalized action, e.g. "Send"; empty for goals saved before verbs existed. */
  verb: string;
  /** Verb + unit, e.g. "Send connection requests". */
  title: string;
  /** Plural noun for what is counted, e.g. "connections". */
  unit: string;
  type: GoalType;
  /** Total for "by-date" goals, per day for "daily" goals. */
  target: number;
  /** YYYY-MM-DD, only for "by-date" goals. */
  deadline: string | null;
  link: string | null;
  startDate: string;
  pauses: Pause[];
  createdAt: string;
  /** What the goal was before an edit changed its number, type or date, and the last day that applied, so past days
   *  keep the number they were done against (user, 2026-10-19: raising the number rewrote finished days). Oldest first. */
  history?: GoalPast[];
}

export interface Entry {
  id: string;
  goalId: string;
  date: string;
  amount: number;
  at: string;
  /** Set on the entry a saved job's "Applied" added, so taking it back removes that one (Assignment 4). */
  savedJobId?: string;
}

export interface Settings {
  reminderTimes: string[];
  notificationsOn: boolean;
  /** True once a calendar file was downloaded or notifications were turned on. */
  nudgesSetUp: boolean;
  /** The day "Not now" was tapped on the set-up-nudges prompt: it stays hidden that day and asks again the next
   *  (user, 2026-10-19: "Not now" is not "never"). */
  nudgePromptSnoozedOn: string | null;
  /** The Monday of the week whose "Last week: ..." summary has been said, so it is said once a week. */
  weekSummarySeenFor: string | null;
  /** True once Titi has pointed at the streak chip (shown once, on the second day). */
  streakTipSeen: boolean;
  /** The last day the downloaded calendar file covers, so Today can say when to grab a new one. */
  calendarUntil: string | null;
  /** The goal a job marked Applied on the Jobs page counts toward, once picked (user, 2026-10-26: ask once, then
   *  remember). Per device, like the other settings. */
  applyGoalId: string | null;
}

/** Set when someone taps Start, until they say how many they did. */
export interface Session {
  goalId: string;
  startedAt: string;
}

export interface AppData {
  version: 1;
  goals: Goal[];
  entries: Entry[];
  settings: Settings;
  lastVisit: string | null;
  session: Session | null;
}

export type DayStatus =
  | "not-started"
  | "started"
  | "done"
  | "paused"
  | "complete"
  | "deadline-passed";
