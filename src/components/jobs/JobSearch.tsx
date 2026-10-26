"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import type { FollowedCompany } from "@/lib/jobs/companies";
import { lookingLine, moreLine, noMatchLine, resultsLine, SEARCH_COPY, someDownLine } from "@/lib/jobs/copy";
import { jobKey, searchRoles, type SearchOutcome } from "@/lib/jobs/saved";
import type { Job } from "@/lib/jobs/types";
import { JobRow } from "./JobRow";

const MAX_QUERY = 100;

interface JobSearchProps {
  companies: FollowedCompany[];
  saved: Set<string>;
  onSave: (job: Job) => Promise<boolean>;
  /** Each search also says how many roles every followed company has open; the company list shows it. */
  onOpenRoles: (openRoles: Record<string, number | null>) => void;
}

/** Search their roles (6c). Before anything is typed it shows the newest roles, so people can browse; a search runs
 *  again when a company is added or removed. */
export function JobSearch({ companies, saved, onSave, onOpenRoles }: JobSearchProps) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [attempt, setAttempt] = useState(0);
  // Each answer remembers which request it belongs to, so "loading" is simply "no answer for this request yet"
  const requestKey = `${companies.map((c) => c.id).join(",")}|${submitted}|${attempt}`;
  const [answer, setAnswer] = useState<{ key: string; outcome: SearchOutcome } | null>(null);

  useEffect(() => {
    let live = true;
    searchRoles(submitted).then((outcome) => {
      if (!live) return;
      setAnswer({ key: requestKey, outcome });
      if (outcome.kind === "result") onOpenRoles(outcome.openRoles);
    });
    return () => {
      live = false;
    };
  }, [requestKey, submitted, onOpenRoles]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length > MAX_QUERY) return setError("Keep the search under 100 characters");
    setError(undefined);
    setSubmitted(trimmed);
  }

  const names = companies.map((c) => c.name);
  const outcome = answer?.key === requestKey ? answer.outcome : null;
  const allDown = outcome?.kind === "failed" || (outcome?.kind === "result" && outcome.unavailable.length > 0 && outcome.unavailable.length === names.length);
  return (
    <section className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-3" role="search" noValidate>
        <Field id="role-search" label={SEARCH_COPY.label} error={error}>
          {(control) => (
            <TextInput {...control} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={SEARCH_COPY.placeholder} maxLength={200} />
          )}
        </Field>
        <Button type="submit" className="w-full">{SEARCH_COPY.search}</Button>
      </form>
      <div role="status" aria-live="polite" className="flex flex-col gap-1 font-bold">
        {!outcome && <p className="text-muted">{lookingLine(names)}</p>}
        {outcome?.kind === "failed" && <p className="text-danger">{SEARCH_COPY.allDown}</p>}
        {outcome?.kind === "refused" && <p className="text-danger">{outcome.message}</p>}
        {outcome?.kind === "result" && <ResultSummary outcome={outcome} query={submitted} names={names} />}
      </div>
      {allDown && (
        <div><Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>{SEARCH_COPY.tryAgain}</Button></div>
      )}
      {outcome?.kind === "result" && outcome.jobs.length > 0 && (
        <ul className="flex flex-col">
          {outcome.jobs.map((job) => (
            <JobRow key={jobKey(job)} job={job} saved={saved.has(jobKey(job))} onSave={onSave} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ResultSummary({ outcome, query, names }: { outcome: Extract<SearchOutcome, { kind: "result" }>; query: string; names: string[] }) {
  const allDown = outcome.unavailable.length > 0 && outcome.unavailable.length === names.length;
  if (allDown) return <p className="text-danger">{SEARCH_COPY.allDown}</p>;
  return (
    <>
      {outcome.unavailable.length > 0 && <p className="text-danger">{someDownLine(outcome.unavailable)}</p>}
      {outcome.total === 0
        ? <p className="text-ink">{query ? noMatchLine(query) : resultsLine(0, "", names)}</p>
        : <p className="text-ink">{resultsLine(outcome.total, query, names)}</p>}
      {outcome.total > outcome.jobs.length && <p className="text-muted">{moreLine(outcome.jobs.length, outcome.total)}</p>}
    </>
  );
}
