"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import type { FollowedCompany } from "@/lib/jobs/companies";
import {
  allCompaniesOption, companyOption, lookingLine, moreLine, noMatchLine, resultsLine, SEARCH_COPY, someDownLine,
} from "@/lib/jobs/copy";
import { jobKey, searchRoles, type SearchOutcome } from "@/lib/jobs/saved";
import { companyKey, type Company } from "@/lib/jobs/service";
import type { Job } from "@/lib/jobs/types";
import { AddCompany } from "./AddCompany";
import { CompanyList } from "./CompanyList";
import { JobRow } from "./JobRow";

const MAX_QUERY = 100;
const ALL = "all";
const ADD = "add";
const MANAGE = "manage";

interface JobSearchProps {
  companies: FollowedCompany[];
  saved: Set<string>;
  onSave: (job: Job) => Promise<boolean>;
  onAdd: (company: Company) => Promise<"followed" | "already" | "limit" | "failed">;
  onRemove: (company: FollowedCompany) => void;
}

/** The Jobs search (user, 2026-10-26): one card with a job title, a company menu and Search, in one row on a desktop
 *  and two on a phone. The menu is the browser's own (keyboard, screen readers and phones' pickers come with it): all
 *  companies, each one with its open roles, then "+ Add a company…" and "Manage companies…", which open a panel under
 *  the card. Before anything is typed it shows the newest roles, so people can browse. */
export function JobSearch({ companies, saved, onSave, onAdd, onRemove }: JobSearchProps) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [chosen, setChosen] = useState("");
  const [panel, setPanel] = useState<typeof ADD | typeof MANAGE | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [attempt, setAttempt] = useState(0);
  const [openRoles, setOpenRoles] = useState<Record<string, number | null>>({});
  const panelRef = useRef<HTMLElement>(null);
  // A company that was removed is no longer a choice: back to all of them
  const only = companies.some((c) => companyKey(c) === chosen) ? chosen : "";
  // Each answer remembers which request it belongs to, so "loading" is simply "no answer for this request yet"
  const requestKey = `${companies.map((c) => c.id).join(",")}|${submitted}|${only}|${attempt}`;
  const [answer, setAnswer] = useState<{ key: string; outcome: SearchOutcome } | null>(null);

  useEffect(() => {
    let live = true;
    searchRoles(submitted, fetch, only).then((outcome) => {
      if (!live) return;
      setAnswer({ key: requestKey, outcome });
      if (outcome.kind === "result") setOpenRoles(outcome.openRoles);
    });
    return () => {
      live = false;
    };
  }, [requestKey, submitted, only]);

  // A panel opened from the menu takes the focus (the name field, or the first Remove), so keyboard users land in it
  useEffect(() => {
    const box = panelRef.current;
    if (panel && box) (box.querySelector<HTMLElement>("input") ?? box.querySelector<HTMLElement>("li button") ?? box.querySelector<HTMLElement>("button"))?.focus();
  }, [panel]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length > MAX_QUERY) return setError("Keep the search under 100 characters");
    setError(undefined);
    setSubmitted(trimmed);
  }

  // Choosing a company searches it right away; the two actions open their panel and leave the choice as it was
  function choose(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (value === ADD || value === MANAGE) return setPanel(value);
    setChosen(value === ALL ? "" : value);
  }

  async function addAndChoose(company: Company) {
    const outcome = await onAdd(company);
    if (outcome === "followed") {
      setChosen(companyKey(company));
      setPanel(null);
    }
    return outcome;
  }

  const names = (only ? companies.filter((c) => companyKey(c) === only) : companies).map((c) => c.name);
  const outcome = answer?.key === requestKey ? answer.outcome : null;
  const allDown = outcome?.kind === "failed" || (outcome?.kind === "result" && outcome.unavailable.length > 0 && outcome.unavailable.length === names.length);
  return (
    <section className="flex flex-col gap-4">
      <form onSubmit={submit} role="search" noValidate
        className="flex flex-col gap-3 rounded-3xl bg-wash p-4 lg:flex-row lg:items-start lg:gap-4 lg:p-5">
        <div className="lg:flex-1">
          <Field id="role-search" label={SEARCH_COPY.label} error={error}>
            {(control) => (
              <TextInput {...control} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={SEARCH_COPY.placeholder} maxLength={200} />
            )}
          </Field>
        </div>
        <div className="flex items-end gap-3 lg:contents">
          <div className="min-w-0 flex-1 lg:w-72 lg:flex-none">
            <Field id="role-company" label={SEARCH_COPY.companyLabel}>
              {(control) => (
                <Select {...control} value={only || ALL} onChange={choose}>
                  <option value={ALL}>{allCompaniesOption(companies.length)}</option>
                  {companies.map((c) => (
                    <option key={c.id} value={companyKey(c)}>{companyOption(c.name, openRoles[companyKey(c)])}</option>
                  ))}
                  <option disabled>──────────</option>
                  <option value={ADD}>{SEARCH_COPY.addOption}</option>
                  <option value={MANAGE}>{SEARCH_COPY.manageOption}</option>
                </Select>
              )}
            </Field>
          </div>
          {/* Lined up with the fields, under their labels */}
          <Button type="submit" className="min-h-12 shrink-0 lg:mt-[2.125rem]">{SEARCH_COPY.search}</Button>
        </div>
      </form>

      {panel && (
        <section ref={panelRef} aria-label={panel === ADD ? SEARCH_COPY.addOption : SEARCH_COPY.manageTitle}
          className="flex flex-col gap-4 border-b-2 border-wash-strong pb-6">
          <div className="flex items-center justify-between gap-3">
            {panel === MANAGE && <h2 className="font-display text-xl font-semibold text-ink">{SEARCH_COPY.manageTitle}</h2>}
            <Button variant="ghost" className="ml-auto" onClick={() => setPanel(null)}>{SEARCH_COPY.done}</Button>
          </div>
          {panel === ADD
            ? <AddCompany followed={new Set(companies.map(companyKey))} prominent={false} onAdd={addAndChoose} />
            : <CompanyList companies={companies} openRoles={openRoles} onRemove={onRemove} />}
        </section>
      )}

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
