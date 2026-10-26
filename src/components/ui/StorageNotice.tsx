"use client";

import { LOAD_FAILED, SAVE_FAILED } from "@/lib/db/copy";
import { reloadData, type StoreState } from "@/lib/store";
import { Button } from "./Button";

/** When goals didn't load, or the last change didn't save. Either way the message says what to do next. */
export function StorageNotice({ state }: { state: StoreState }) {
  if (state.kind === "load-failed") {
    return (
      <section role="alert" className="mt-6 flex flex-col gap-4 rounded-lg border-2 border-danger p-4">
        <h1 className="text-xl font-bold text-ink">{LOAD_FAILED.title}</h1>
        <p className="text-ink">{LOAD_FAILED.next}</p>
        <div>
          <Button variant="secondary" onClick={reloadData}>Try again</Button>
        </div>
      </section>
    );
  }
  return (
    <p role="alert" className="mt-2 rounded-2xl bg-surface px-4 py-3 text-sm font-bold text-ink shadow-[0_2px_12px_rgba(61,59,51,.10)]">
      {SAVE_FAILED}
    </p>
  );
}

