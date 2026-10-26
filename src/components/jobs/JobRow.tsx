"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { JOBS_COPY, SEARCH_COPY } from "@/lib/jobs/copy";
import { postedAgo } from "@/lib/jobs/saved";
import type { Job } from "@/lib/jobs/types";

interface JobRowProps {
  job: Job;
  saved: boolean;
  onSave: (job: Job) => Promise<boolean>;
}

/** One role. The row itself can't be tapped, so it has no box; Save is the clay button, and "View posting" opens the
 *  job on its own hiring site, where people apply (and which credits the source). */
export function JobRow({ job, saved, onSave }: JobRowProps) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const details = [job.company, job.location, postedAgo(job.postedAt)].filter(Boolean).join(" · ");

  async function save() {
    setSaving(true);
    setFailed(false);
    const ok = await onSave(job);
    setSaving(false);
    setFailed(!ok);
  }

  return (
    <li className="flex flex-col gap-2 border-b-2 border-wash-strong py-4 last:border-b-0">
      <p className="font-display text-lg font-semibold leading-snug text-ink">{job.title}</p>
      <p className="text-sm font-bold text-muted">{details}</p>
      <div className="flex items-center justify-between gap-3">
        {saved ? (
          <span className="inline-flex min-h-11 items-center font-bold text-ink">{SEARCH_COPY.saved}</span>
        ) : (
          <Button variant="secondary" onClick={() => void save()} disabled={saving} aria-label={`Save ${job.title} at ${job.company}`}>
            {saving ? SEARCH_COPY.saving : SEARCH_COPY.save}
          </Button>
        )}
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center px-1 font-display font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink focus-visible:outline-3 focus-visible:outline-focus"
        >
          {SEARCH_COPY.view}
          <span className="sr-only"> {SEARCH_COPY.newTab}</span>
        </a>
      </div>
      {failed && <p role="alert" className="text-sm font-semibold text-danger">{JOBS_COPY.saveFailed}</p>}
    </li>
  );
}
