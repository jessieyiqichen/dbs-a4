"use client";

import { useSyncExternalStore } from "react";
import { diffData, hasChanges, type Changes } from "./db/diff";
import { loadRemote, saveChanges, type Db } from "./db/remote";
import { browserStore, DEVICE_KEY, loadDevice, saveDevice, type DeviceData } from "./storage";
import type { Removed } from "./goals";
import type { AppData, Entry, Goal } from "./types";

/** Null while goals are loading (and on the server). `saveFailed`: the last change didn't reach the database, so the
 *  screen shows what the database holds and says so. */
export type StoreState =
  | { kind: "ready"; data: AppData; saveFailed: boolean }
  | { kind: "load-failed" };

type Remote = { goals: Goal[]; entries: Entry[] };

let db: Db | null = null;
let userId: string | null = null;
/** Bumped when the person changes (sign-out, another account) or a save fails, so late answers for the old state are
 *  ignored instead of overwriting the new one. */
let generation = 0;
let remote: Remote | "loading" | "failed" = "loading";
let device: DeviceData | null = null;
let saveFailed = false;
let pending = 0;
let loadedAt = 0;
/** Coming back to the tab reloads at most once a minute: tabs can flip between hidden and visible every few seconds
 *  (seen in the desktop app's browser pane, a load every 2 seconds), and goals from another device can wait that long. */
const REFRESH_AFTER_MS = 60_000;
let queue: Promise<void> = Promise.resolve();
let cache: StoreState | null = null;
let cacheValid = false;
const listeners = new Set<() => void>();

/** How this visit started, captured once per page load before lastVisit is updated. */
export interface VisitStart {
  prevVisit: string | null;
  fromNudge: boolean;
  /** The week whose summary had been said when this visit began, so marking it said keeps it on screen this visit. */
  summarySeenFor: string | null;
}
let visitStart: VisitStart | null = null;

export function getVisitStart(): VisitStart {
  readDevice();
  return visitStart ?? { prevVisit: null, fromNudge: false, summarySeenFor: null };
}

function readDevice(): DeviceData {
  if (device) return device;
  device = loadDevice(browserStore());
  visitStart ??= {
    prevVisit: device.lastVisit,
    fromNudge: new URLSearchParams(window.location.search).get("from") === "nudge",
    summarySeenFor: device.settings.weekSummarySeenFor,
  };
  return device;
}

function snapshot(): StoreState | null {
  if (cacheValid) return cache;
  if (remote === "loading") cache = null;
  else if (remote === "failed") cache = { kind: "load-failed" };
  else cache = { kind: "ready", data: { version: 1, ...remote, ...readDevice() }, saveFailed };
  cacheValid = true;
  return cache;
}

function changed() {
  cacheValid = false;
  listeners.forEach((listener) => listener());
}

async function fetchRemote(gen: number): Promise<void> {
  if (!db) return;
  try {
    const loaded = await loadRemote(db);
    if (gen !== generation) return;
    remote = loaded;
    loadedAt = Date.now();
  } catch (error) {
    if (gen !== generation) return;
    console.error(error);
    remote = "failed";
  }
  changed();
}

/** Signed in: load this person's goals through a client that sends their session token. */
export function connect(id: string, makeDb: () => Db): void {
  if (id === userId) return;
  userId = id;
  generation += 1;
  remote = "loading";
  saveFailed = false;
  try {
    db = makeDb();
  } catch (error) {
    console.error(error);
    db = null;
    remote = "failed";
  }
  changed();
  void fetchRemote(generation);
}

/** Signed out: forget the last person's goals, so nothing of theirs stays on screen for whoever signs in next. */
export function disconnect(): void {
  if (userId === null) return;
  userId = null;
  db = null;
  generation += 1;
  remote = "loading";
  changed();
}

/** The signed-in person's Supabase client, for pages that keep their own rows (the companies on Jobs); null until
 *  someone is signed in. */
export function currentDb(): Db | null {
  return db;
}

/** "Try again" after goals didn't load. */
export function reloadData(): void {
  if (!db) return;
  remote = "loading";
  changed();
  void fetchRemote(generation);
}

/** Writes go one at a time in the order they were made, each built on the one before. */
function enqueue(changes: Changes) {
  const client = db;
  const gen = generation;
  if (!client) return;
  pending += 1;
  queue = queue.then(async () => {
    try {
      if (gen === generation) await saveChanges(client, changes);
    } catch (error) {
      if (gen !== generation) return;
      console.error(error);
      // Writes still waiting were built on this one, so they are dropped and the screen goes back to what was saved
      generation += 1;
      saveFailed = true;
      changed();
      await fetchRemote(generation);
    } finally {
      pending -= 1;
    }
  });
}

/** Back on the tab: pick up changes made on another device, unless this one still has writes on the way. */
function onVisible() {
  if (document.visibilityState !== "visible" || pending > 0 || typeof remote !== "object") return;
  if (Date.now() - loadedAt < REFRESH_AFTER_MS) return;
  void fetchRemote(generation);
}

/** Another tab changed this device's settings: read them again. */
function onStorage(event: StorageEvent) {
  if (event.key !== DEVICE_KEY) return;
  device = null;
  changed();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("storage", onStorage);
  };
}

/** Null while rendering on the server or loading; the person's goals once they arrive. */
export function useStore(): StoreState | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

/** Applies a change on screen right away and saves it: settings on this device, goals and entries to Supabase in the
 *  background. Returns false when there is nothing loaded to change yet. */
export function updateData(change: (data: AppData) => AppData): boolean {
  const current = snapshot();
  if (current?.kind !== "ready") return false;
  const next = change(current.data);
  if (next === current.data) return true;
  device = { settings: next.settings, lastVisit: next.lastVisit, session: next.session };
  saveDevice(next, browserStore());
  remote = { goals: next.goals, entries: next.entries };
  const changes = diffData(current.data, next);
  if (hasChanges(changes)) {
    saveFailed = false;
    enqueue(changes);
  }
  changed();
  return true;
}

let focusGoalId: string | null = null;

/** Shows this goal first on Today (e.g. one just created), until it's done. */
export function setFocusGoal(id: string | null): void {
  focusGoalId = id;
}

export function getFocusGoal(): string | null {
  return focusGoalId;
}

/** A goal removed on one page can be undone on the next (Progress removes, Goals shows the Undo). */
let removedGoal: Removed | null = null;
const removedListeners = new Set<() => void>();
export function stashRemoved(removed: Removed | null): void {
  removedGoal = removed;
  removedListeners.forEach((l) => l());
}
export function useRemoved(): Removed | null {
  return useSyncExternalStore(
    (l) => {
      removedListeners.add(l);
      return () => removedListeners.delete(l);
    },
    () => removedGoal,
    () => null,
  );
}

/** A one-line confirmation carried to the next page ("Saved changes" after Edit goal), shown there in a toast. */
let notice: string | null = null;
const noticeListeners = new Set<() => void>();
export function stashNotice(text: string | null): void {
  notice = text;
  noticeListeners.forEach((l) => l());
}
export function useNotice(): string | null {
  return useSyncExternalStore(
    (l) => {
      noticeListeners.add(l);
      return () => noticeListeners.delete(l);
    },
    () => notice,
    () => null,
  );
}

/** The latest data, for timers that fire outside React. */
export function currentData(): AppData | null {
  const state = snapshot();
  return state?.kind === "ready" ? state.data : null;
}
