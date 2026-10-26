"use client";

import { useRouter } from "next/navigation";
import { GoalWizard } from "@/components/onboarding/GoalWizard";
import { StorageNotice } from "@/components/ui/StorageNotice";
import { useStore } from "@/lib/store";

/** Adding a goal later is the same walk with Titi as the first visit; it ends in the session with the new goal started. */
export function NewGoalScreen() {
  const router = useRouter();
  const state = useStore();
  if (state === null) return <p className="pt-6 text-muted">Loading…</p>;
  if (state.kind === "load-failed") return <StorageNotice state={state} />;
  return (
    <>
      {state.saveFailed && <StorageNotice state={state} />}
      <GoalWizard onCancel={() => router.push("/goals")} onStarted={() => router.push("/session")} />
    </>
  );
}
