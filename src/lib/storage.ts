import type { AppData, Entry, Goal, GoalPast, Session, Settings } from "./types";
import { webLink } from "./validate";

/** Goals and entries live in Supabase; only what belongs to this device stays in localStorage (AGENTS.md): settings,
 *  the session in progress and the last visit. A new key, so A3's "nudge:v1" (goals included) is never read as this. */
export const DEVICE_KEY = "nudge:device:v1";
export const DEFAULT_REMINDER_TIMES = ["10:00", "15:00", "20:00"];

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type DeviceData = Pick<AppData, "settings" | "lastVisit" | "session">;

export function emptyData(): AppData {
  return {
    version: 1,
    goals: [],
    entries: [],
    settings: { reminderTimes: DEFAULT_REMINDER_TIMES, notificationsOn: false, nudgesSetUp: false, nudgePromptSnoozedOn: null, weekSummarySeenFor: null, streakTipSeen: false, calendarUntil: null, applyGoalId: null },
    lastVisit: null,
    session: null,
  };
}

const isString = (v: unknown): v is string => typeof v === "string";
const isNullableString = (v: unknown) => v === null || isString(v);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** A kept record of a goal's past number (see Goal.history); anything malformed is dropped, not trusted. */
export function isGoalPast(v: unknown): v is GoalPast {
  return (
    isRecord(v) &&
    isString(v.to) && /^\d{4}-\d{2}-\d{2}$/.test(v.to) &&
    typeof v.target === "number" && Number.isInteger(v.target) && v.target > 0 &&
    (v.type === "daily" || v.type === "by-date") &&
    (v.deadline === null || isString(v.deadline))
  );
}

function isGoal(v: unknown): v is Omit<Goal, "verb"> & { verb?: unknown } {
  return (
    isRecord(v) &&
    isString(v.id) && isString(v.title) && isString(v.unit) &&
    (v.verb === undefined || isString(v.verb)) &&
    (v.type === "by-date" || v.type === "daily") &&
    typeof v.target === "number" && v.target > 0 &&
    isNullableString(v.deadline) && isNullableString(v.link) &&
    isString(v.startDate) && isString(v.createdAt) &&
    Array.isArray(v.pauses) && v.pauses.every((p) => isRecord(p) && isString(p.from) && isString(p.to))
  );
}

function isEntry(v: unknown): v is Entry {
  return (
    isRecord(v) &&
    isString(v.id) && isString(v.goalId) && isString(v.date) && isString(v.at) &&
    typeof v.amount === "number"
  );
}

function parseSettings(settings: unknown): Settings | null {
  if (!isRecord(settings) || !Array.isArray(settings.reminderTimes)) return null;
  if (!settings.reminderTimes.every(isString) || typeof settings.notificationsOn !== "boolean") return null;
  // Settings added after the first release default to false.
  return {
    reminderTimes: settings.reminderTimes,
    notificationsOn: settings.notificationsOn,
    nudgesSetUp: settings.nudgesSetUp === true,
    // A date or nothing; the old forever "Not now" flag is dropped, so the prompt asks again
    nudgePromptSnoozedOn: isString(settings.nudgePromptSnoozedOn) && /^\d{4}-\d{2}-\d{2}$/.test(settings.nudgePromptSnoozedOn) ? settings.nudgePromptSnoozedOn : null,
    weekSummarySeenFor: isString(settings.weekSummarySeenFor) && /^\d{4}-\d{2}-\d{2}$/.test(settings.weekSummarySeenFor) ? settings.weekSummarySeenFor : null,
    streakTipSeen: settings.streakTipSeen === true,
    calendarUntil: isString(settings.calendarUntil) ? settings.calendarUntil : null,
    applyGoalId: isString(settings.applyGoalId) ? settings.applyGoalId : null,
  };
}

function parseSession(value: unknown): Session | null {
  return isRecord(value) && isString(value.goalId) && isString(value.startedAt)
    ? { goalId: value.goalId, startedAt: value.startedAt }
    : null;
}

function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Parses and validates a backup file. Returns null if the shape is wrong. */
export function parseData(text: string): AppData | null {
  const value = parseJSON(text);
  if (!isRecord(value) || value.version !== 1) return null;
  const { goals, entries, lastVisit } = value;
  if (!Array.isArray(goals) || !goals.every(isGoal)) return null;
  if (!Array.isArray(entries) || !entries.every(isEntry)) return null;
  const settings = parseSettings(value.settings);
  if (!settings || !isNullableString(lastVisit)) return null;
  return {
    version: 1,
    // Goals saved before verbs existed get an empty verb.
    goals: goals.map((g) => {
      const { history, ...rest } = g as typeof g & { history?: unknown };
      const kept = Array.isArray(history) ? history.filter(isGoalPast) : [];
      return { ...rest, link: webLink(rest.link), verb: isString(g.verb) ? g.verb : "", ...(kept.length > 0 ? { history: kept } : {}) };
    }),
    entries,
    settings,
    lastVisit,
    session: parseSession(value.session),
  };
}

function parseDevice(text: string): DeviceData | null {
  const value = parseJSON(text);
  if (!isRecord(value)) return null;
  const settings = parseSettings(value.settings);
  if (!settings || !isNullableString(value.lastVisit)) return null;
  return { settings, lastVisit: value.lastVisit, session: parseSession(value.session) };
}

function deviceDefaults(): DeviceData {
  const { settings, lastVisit, session } = emptyData();
  return { settings, lastVisit, session };
}

/** This device's settings; defaults when none are saved, storage is blocked, or what is saved can't be read (settings
 *  are easy to set again, so there is nothing to rescue, unlike goals). */
export function loadDevice(store: KeyValueStore | null): DeviceData {
  const raw = store?.getItem(DEVICE_KEY) ?? null;
  if (raw === null) return deviceDefaults();
  const device = parseDevice(raw);
  if (!device) console.error("Nudge: this device's saved settings couldn't be read, using the defaults");
  return device ?? deviceDefaults();
}

export function saveDevice(data: AppData, store: KeyValueStore | null): boolean {
  if (!store) return false;
  const device: DeviceData = { settings: data.settings, lastVisit: data.lastVisit, session: data.session };
  try {
    store.setItem(DEVICE_KEY, JSON.stringify(device));
    return true;
  } catch (error) {
    console.error("Nudge: could not save settings to localStorage", error);
    return false;
  }
}

/** localStorage, or null when the browser blocks it (private mode, disabled storage). */
export function browserStore(): KeyValueStore | null {
  try {
    const probe = "nudge:probe";
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}
