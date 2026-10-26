"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { RemoveGoalButton } from "@/components/progress/GoalActions";
import { CatArt } from "@/components/today/CatArt";
import { ButtonLink } from "@/components/ui/Button";
import { StorageNotice } from "@/components/ui/StorageNotice";
import { updateGoal } from "@/lib/actions";
import { toISODate } from "@/lib/dates";
import { stashNotice, useStore } from "@/lib/store";
import { draftFromGoal, GoalSetup } from "./GoalSetup";

/** Editing a goal. The page heading comes in as `header` so it can sit in the form's own grid on a desktop. */
export function EditGoalScreen({
  id,
  header,
}: {
  id: string;
  header: ReactNode;
}) {
  const router = useRouter();
  const state = useStore();
  if (state === null)
    return (
      <>
        {header}
        <p className="pt-6 text-muted">Loading your goal…</p>
      </>
    );
  if (state.kind === "load-failed")
    return (
      <>
        {header}
        <StorageNotice state={state} />
      </>
    );

  const goal = state.data.goals.find((g) => g.id === id);
  if (!goal) {
    return (
      <>
        {header}
        <div className="mt-8 flex flex-col gap-4">
          <p className="text-lg font-bold text-ink">
            This goal isn&apos;t saved on this device, it may have been deleted
          </p>
          <ButtonLink href="/goals" className="self-start">
            See your goals
          </ButtonLink>
        </div>
      </>
    );
  }
  return (
    <div>
      <GoalSetup
        header={header}
        after={<RemoveGoalButton goalId={goal.id} />}
        aside={
          <div className="flex flex-col items-center gap-3">
            <CatArt mood="idle" className="w-60" />
            <p className="text-center font-bold text-muted">
              Change anything here, everything you&apos;ve done so far stays
            </p>
          </div>
        }
        initial={draftFromGoal(goal)}
        fields="full"
        submitLabel="Save changes"
        onSubmit={(values) => {
          updateGoal(goal.id, values, toISODate(new Date()));
          // Back on the progress page a toast says it took (first-run check 2: no confirmation after saving)
          stashNotice("Saved changes");
          router.push(`/goals/${goal.id}`);
        }}
      />
    </div>
  );
}
