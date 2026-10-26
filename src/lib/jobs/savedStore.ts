"use client";

import { useEffect, useSyncExternalStore } from "react";
import { addEntry, removeEntriesForJob } from "../actions";
import { currentDb, currentUserId, useStore } from "../store";
import { loadSaved, removeSaved, restoreSaved, saveJob, savedKey, setApplied, type SavedJob } from "./saved";
import type { Job } from "./types";

/** The saved jobs, shared by the Jobs page and the applications goal's page so both always show the same list (6d). */
export type SavedState =
  | { kind: "loading" }
  | { kind: "ready"; jobs: SavedJob[]; closed: Set<string> }
  | { kind: "load-failed" };

let forUser: string | null = null;
let state: SavedState = { kind: "loading" };
const listeners = new Set<() => void>();

function set(next: SavedState) {
  state = next;
  listeners.forEach((l) => l());
}

function update(change: (jobs: SavedJob[]) => SavedJob[]) {
  if (state.kind === "ready") set({ ...state, jobs: change(state.jobs) });
}

/** Asks our server which saved jobs are no longer posted. Not knowing is fine: they simply aren't marked closed. */
async function checkClosed(user: string) {
  try {
    const response = await fetch("/api/jobs/saved-status");
    const body = (await response.json()) as { closed?: unknown };
    if (!response.ok || !Array.isArray(body.closed) || forUser !== user || state.kind !== "ready") return;
    set({ ...state, closed: new Set(body.closed.filter((k): k is string => typeof k === "string")) });
  } catch (error) {
    console.error("Jobs: could not check which saved jobs are still posted", error);
  }
}

async function load(user: string) {
  const db = currentDb();
  if (!db) return;
  try {
    const jobs = await loadSaved(db);
    if (forUser !== user) return;
    set({ kind: "ready", jobs, closed: new Set() });
    if (jobs.length > 0) void checkClosed(user);
  } catch (error) {
    console.error(error);
    if (forUser === user) set({ kind: "load-failed" });
  }
}

/** Loads the signed-in person's saved jobs once, and again when someone else signs in. */
export function useSavedJobs(): SavedState {
  const signedIn = useStore() !== null;
  useEffect(() => {
    const user = signedIn ? currentUserId() : null;
    if (user === forUser) return;
    forUser = user;
    set({ kind: "loading" });
    if (user) void load(user);
  }, [signedIn]);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export function retrySaved(): void {
  if (!forUser) return;
  set({ kind: "loading" });
  void load(forUser);
}

export const savedKeys = (s: SavedState) => new Set(s.kind === "ready" ? s.jobs.map(savedKey) : []);

export async function saveFoundJob(job: Job): Promise<boolean> {
  const db = currentDb();
  if (!db) return false;
  const result = await saveJob(db, job);
  if (result.kind === "saved") update((jobs) => [result.saved, ...jobs]);
  // Saved somewhere else meanwhile (another tab): read the list again so it shows
  if (result.kind === "already" && forUser) void load(forUser);
  return result.kind !== "failed";
}

/** Marks a saved job applied and, when a goal is given, counts one on it, linked to the job (AGENTS.md). Returns the
 *  entry's id for Undo, null when nothing was counted, or false when the change didn't save. */
export async function applySaved(saved: SavedJob, goalId: string | null, today: string): Promise<string | null | false> {
  const db = currentDb();
  const at = new Date().toISOString();
  if (!db || !(await setApplied(db, saved.id, at))) return false;
  update((jobs) => jobs.map((j) => (j.id === saved.id ? { ...j, status: "applied", appliedAt: at } : j)));
  return goalId ? addEntry(goalId, 1, today, saved.id).id : null;
}

/** Back to saved: the +1 it added is taken back too. */
export async function unapplySaved(saved: SavedJob): Promise<boolean> {
  const db = currentDb();
  if (!db || !(await setApplied(db, saved.id, null))) return false;
  update((jobs) => jobs.map((j) => (j.id === saved.id ? { ...j, status: "saved", appliedAt: null } : j)));
  removeEntriesForJob(saved.id);
  return true;
}

/** Off the list right away, back if the database said no. An applied job's +1 stays: they did apply. */
export async function removeSavedJob(saved: SavedJob): Promise<boolean> {
  const db = currentDb();
  if (!db) return false;
  update((jobs) => jobs.filter((j) => j.id !== saved.id));
  const ok = await removeSaved(db, saved.id);
  if (!ok) update((jobs) => [...jobs, saved].sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
  return ok;
}

export async function undoRemoveSaved(saved: SavedJob): Promise<boolean> {
  const db = currentDb();
  if (!db || !(await restoreSaved(db, saved))) return false;
  update((jobs) => [...jobs, saved].sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
  return true;
}
