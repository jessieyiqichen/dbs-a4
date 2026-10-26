"use client";

import { useCallback, useEffect, useState } from "react";
import { jobKey, loadSavedKeys, saveJob } from "@/lib/jobs/saved";
import type { Job } from "@/lib/jobs/types";
import { currentDb, useStore } from "@/lib/store";

/** Which jobs this person has saved (to show "Saved" in the results), and saving one more. 6d adds the list itself. */
export function useSavedJobs() {
  const connected = useStore() !== null;
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    const db = currentDb();
    if (!connected || !db) return;
    let live = true;
    loadSavedKeys(db).then(
      (keys) => live && setSaved(keys),
      // Not knowing what's saved only means no "Saved" marks; saving still works and says so if it fails
      (error) => console.error(error),
    );
    return () => {
      live = false;
    };
  }, [connected]);

  const save = useCallback(async (job: Job): Promise<boolean> => {
    const db = currentDb();
    if (!db || (await saveJob(db, job)) === "failed") return false;
    setSaved((keys) => new Set(keys).add(jobKey(job)));
    return true;
  }, []);

  return { saved, save };
}
