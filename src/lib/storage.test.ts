import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEVICE_KEY, emptyData, loadDevice, parseData, saveDevice } from "./storage";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, value); }
  removeItem(key: string) { this.store.delete(key); }
}

const { settings, lastVisit, session } = emptyData();
const deviceDefaults = { settings, lastVisit, session };

describe("storage: what stays on this device", () => {
  let storage: MemoryStorage;
  beforeEach(() => { storage = new MemoryStorage(); });

  it("starts with default settings when nothing is saved", () => {
    expect(loadDevice(storage)).toEqual(deviceDefaults);
  });

  it("round-trips settings, the last visit and the session in progress, and nothing else", () => {
    const device = { ...deviceDefaults, lastVisit: "2026-10-26", session: { goalId: "g", startedAt: "2026-10-26T15:00:00.000Z" } };
    expect(saveDevice({ ...emptyData(), ...device, goals: [] }, storage)).toBe(true);
    expect(JSON.parse(storage.getItem(DEVICE_KEY) ?? "{}")).not.toHaveProperty("goals");
    expect(loadDevice(storage)).toEqual(device);
  });

  it("falls back to defaults when the saved settings can't be read, and says so in the console", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    storage.setItem(DEVICE_KEY, "{not json");
    expect(loadDevice(storage)).toEqual(deviceDefaults);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("works without storage (private mode), it just can't keep settings", () => {
    expect(loadDevice(null)).toEqual(deviceDefaults);
    expect(saveDevice(emptyData(), null)).toBe(false);
  });

  it("rejects a backup with the wrong shape", () => {
    expect(parseData(JSON.stringify({ version: 1, goals: "nope" }))).toBeNull();
    expect(parseData(JSON.stringify({ ...emptyData(), goals: [{ id: 1 }] }))).toBeNull();
  });
});

describe("storage: older saved data", () => {
  it("fills in settings added later", () => {
    const old = { ...emptyData(), settings: { reminderTimes: ["10:00"], notificationsOn: false } };
    const parsed = parseData(JSON.stringify(old));
    expect(parsed?.settings).toEqual({ reminderTimes: ["10:00"], notificationsOn: false, nudgesSetUp: false, nudgePromptSnoozedOn: null, weekSummarySeenFor: null, streakTipSeen: false, calendarUntil: null, applyGoalId: null });
    expect(parsed?.session).toBeNull();
  });

  it("keeps a snooze date, drops anything else, and lets an old forever-\"Not now\" ask again", () => {
    const snoozed = { ...emptyData(), settings: { ...emptyData().settings, nudgePromptSnoozedOn: "2026-10-19" } };
    expect(parseData(JSON.stringify(snoozed))?.settings.nudgePromptSnoozedOn).toBe("2026-10-19");
    const junk = { ...emptyData(), settings: { ...emptyData().settings, nudgePromptSnoozedOn: "soon" } };
    expect(parseData(JSON.stringify(junk))?.settings.nudgePromptSnoozedOn).toBeNull();
    const old = { ...emptyData(), settings: { reminderTimes: ["10:00"], notificationsOn: false, nudgePromptDismissed: true } };
    expect(parseData(JSON.stringify(old))?.settings.nudgePromptSnoozedOn).toBeNull();
  });

  it("gives older goals an empty verb", () => {
    const goal = { id: "g", title: "Apply to jobs", unit: "applications", type: "daily", target: 10, deadline: null, link: null, startDate: "2026-10-17", pauses: [], createdAt: "" };
    expect(parseData(JSON.stringify({ ...emptyData(), goals: [goal] }))?.goals[0].verb).toBe("");
  });
});

describe("storage: a goal's kept history", () => {
  const goal = { id: "g", verb: "Send", title: "Send applications", unit: "applications", type: "daily", target: 3, deadline: null, link: null, startDate: "2026-10-12", pauses: [], createdAt: "" };
  it("keeps valid records of past numbers and drops anything malformed", () => {
    const good = { to: "2026-10-18", target: 2, type: "daily", deadline: null };
    const data = { ...emptyData(), goals: [{ ...goal, history: [good, { to: "soon", target: -1 }] }] };
    expect(parseData(JSON.stringify(data))?.goals[0].history).toEqual([good]);
    expect(parseData(JSON.stringify({ ...emptyData(), goals: [goal] }))?.goals[0].history).toBeUndefined();
  });
});
