"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { restoreData } from "@/lib/actions";
import { toISODate } from "@/lib/dates";
import { BACKUP_NOTE } from "@/lib/db/copy";
import { downloadText } from "@/lib/download";
import { parseData } from "@/lib/storage";
import type { AppData } from "@/lib/types";

const BAD_FILE = "That isn't a Nudge backup, choose the .json file you downloaded";

/** Seldom used, so it stays folded: a copy of your goals, and a way to bring one back. */
export function BackupSection({ data }: { data: AppData }) {
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState<AppData | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    setDone(null);
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseData(await file.text());
      setError(parsed ? undefined : BAD_FILE);
      setPending(parsed);
    } catch (readError) {
      console.error("Nudge: could not read backup file", readError);
      setError("That file couldn't be opened, try choosing it again");
      setPending(null);
    }
  }

  function confirmRestore() {
    if (!pending) return;
    restoreData(pending);
    setDone(`Restored ${pending.goals.length === 1 ? "1 goal" : `${pending.goals.length} goals`}!`);
    setPending(null);
  }

  return (
    <details className="group mt-2 rounded-3xl bg-wash px-5 py-3 open:pb-5">
      <summary className="flex cursor-pointer list-none items-center justify-between font-display text-lg font-semibold text-ink focus-visible:outline-3 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
        Backup
        <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-90">→</span>
      </summary>
      <div className="mt-3 flex flex-col gap-4">
        <p className="text-sm font-bold text-muted">{BACKUP_NOTE}</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => downloadText(JSON.stringify(data, null, 2), `nudge-backup-${toISODate(new Date())}.json`, "application/json")}>
            Download a copy
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>Restore from a file</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={choose} className="sr-only" aria-label="Restore from a backup file" tabIndex={-1} />
        </div>
        {error && <p role="alert" className="text-sm font-bold text-danger">{error}</p>}
        {pending && (
          <div role="alert" className="flex flex-col gap-3 px-1 py-2">
            <p className="font-bold text-ink">
              This replaces all your goals with the {pending.goals.length === 1 ? "1 goal" : `${pending.goals.length} goals`} in the file
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" onClick={confirmRestore}>Replace with backup</Button>
              <Button variant="ghost" onClick={() => setPending(null)}>Keep what I have</Button>
            </div>
          </div>
        )}
        {done && <p role="status" className="font-bold text-ink">{done}</p>}
      </div>
    </details>
  );
}
