"use client";

import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/Button";
import { SAVED_COPY, SEARCH_COPY } from "@/lib/jobs/copy";
import type { SavedJob } from "@/lib/jobs/saved";

/** On an applications goal's page, the saved jobs still to apply to (user, 2026-10-26): open one on its own site, apply
 *  there, then "I applied" counts it here. Applied ones leave the list, so the next one is always on top. */
export function SessionSaved({ jobs, onApplied }: { jobs: SavedJob[]; onApplied: (job: SavedJob) => void }) {
  if (jobs.length === 0) {
    return (
      <Link href="/jobs" className="mt-8 self-start font-bold text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink focus-visible:outline-3 focus-visible:outline-focus">
        {SAVED_COPY.findMore}
      </Link>
    );
  }
  return (
    <section aria-labelledby="session-saved" className="mt-10 flex flex-col">
      <h2 id="session-saved" className="font-display text-xl font-semibold text-ink">{SAVED_COPY.sessionHeading}</h2>
      <ul className="mt-2 flex flex-col">
        {jobs.map((job) => (
          <li key={job.id} className="flex flex-col gap-2 border-b-2 border-wash-strong py-4 last:border-b-0">
            <p className="font-display text-lg font-semibold leading-snug text-ink">{job.title}</p>
            <p className="text-sm font-bold text-muted">{[job.company, job.location].filter(Boolean).join(" · ")}</p>
            <div className="flex flex-wrap gap-3">
              <a href={job.url} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "secondary" })}>
                {SAVED_COPY.apply}<span className="sr-only"> {SEARCH_COPY.newTab}</span>
              </a>
              <Button variant="secondary" onClick={() => onApplied(job)} aria-label={`I applied to ${job.title} at ${job.company}`}>
                {SAVED_COPY.iApplied}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
