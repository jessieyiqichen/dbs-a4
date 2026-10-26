"use client";

import { useCallback, useEffect, useState } from "react";
import { follow, loadFollowed, refollow, unfollow, type FollowedCompany, type FollowResult } from "@/lib/jobs/companies";
import type { Company } from "@/lib/jobs/service";
import { currentDb, useStore } from "@/lib/store";

export type CompaniesState =
  | { kind: "loading" }
  | { kind: "ready"; companies: FollowedCompany[] }
  | { kind: "load-failed" };

const byAdded = (a: FollowedCompany, b: FollowedCompany) => a.addedAt.localeCompare(b.addedAt);

/** The companies this person follows, from Supabase. Waits for sign-in to connect the database (the goals store does
 *  that), then loads once. How many roles each has open comes with the search (JobSearch). */
export function useCompanies() {
  const store = useStore();
  const connected = store !== null;
  const [state, setState] = useState<CompaniesState>({ kind: "loading" });
  // Bumped by "Try again" to load once more
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const db = currentDb();
    if (!connected || !db) return;
    let live = true;
    loadFollowed(db).then(
      (companies) => {
        if (!live) return;
        setState({ kind: "ready", companies });
      },
      (error) => {
        console.error(error);
        if (live) setState({ kind: "load-failed" });
      },
    );
    return () => {
      live = false;
    };
  }, [connected, attempt]);

  const retry = useCallback(() => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const add = useCallback(async (company: Company): Promise<FollowResult> => {
    const db = currentDb();
    if (!db) return { kind: "failed" };
    const result = await follow(db, company);
    if (result.kind === "followed") {
      setState((s) => (s.kind === "ready" ? { kind: "ready", companies: [...s.companies, result.company].sort(byAdded) } : s));
    }
    return result;
  }, []);

  /** Off the list right away; put back if the database said no. */
  const remove = useCallback(async (company: FollowedCompany): Promise<boolean> => {
    const db = currentDb();
    if (!db) return false;
    setState((s) => (s.kind === "ready" ? { kind: "ready", companies: s.companies.filter((c) => c.id !== company.id) } : s));
    const ok = await unfollow(db, company.id);
    if (!ok) setState((s) => (s.kind === "ready" ? { kind: "ready", companies: [...s.companies, company].sort(byAdded) } : s));
    return ok;
  }, []);

  const undoRemove = useCallback(async (company: FollowedCompany): Promise<boolean> => {
    const db = currentDb();
    if (!db || !(await refollow(db, company))) return false;
    setState((s) => (s.kind === "ready" ? { kind: "ready", companies: [...s.companies, company].sort(byAdded) } : s));
    return true;
  }, []);

  return { state, retry, add, remove, undoRemove };
}
