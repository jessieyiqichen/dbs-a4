"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Select, TextInput } from "@/components/ui/Field";
import type { FollowedCompany } from "@/lib/jobs/companies";
import {
  allCompaniesOption, companyOption, lookingLine, moreLine, noMatchLine, resultsLine, SEARCH_COPY, showMoreLabel, someDownLine,
} from "@/lib/jobs/copy";
import { jobKey, searchRoles, type SearchOutcome } from "@/lib/jobs/saved";
import { companyKey, PAGE_SIZE, type Company } from "@/lib/jobs/service";
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
  // "Show 20 more" (user, 2026-10-26): the pages after the first, kept with the request they belong to, so a new search
  // starts again from 20
  const [more, setMore] = useState<{ key: string; jobs: Job[]; loading: boolean; error?: string }>({ key: "", jobs: [], loading: false });
  const listRef = useRef<HTMLUListElement>(null);
  const focusFrom = useRef<number | null>(null);

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

  // Managing opens a panel under the card, which takes the focus (the first Remove), so keyboard users land in it
  useEffect(() => {
    const box = panelRef.current;
    if (panel && box) (box.querySelector<HTMLElement>("input") ?? box.querySelector<HTMLElement>("li button") ?? box.querySelector<HTMLElement>("button"))?.focus();
  }, [panel]);

  // After a page arrives, the focus moves to its first role, so a keyboard user carries on from there
  const extraCount = more.key === requestKey ? more.jobs.length : 0;
  useEffect(() => {
    const from = focusFrom.current;
    if (from === null) return;
    focusFrom.current = null;
    listRef.current?.children[from]?.querySelector<HTMLElement>("button, a")?.focus();
  }, [extraCount]);

  async function showMore(from: number) {
    const key = requestKey;
    setMore((m) => ({ key, jobs: m.key === key ? m.jobs : [], loading: true }));
    const next = await searchRoles(submitted, fetch, only, from);
    if (next.kind === "result") focusFrom.current = from;
    setMore((m) => {
      if (m.key !== key) return m;
      if (next.kind !== "result") return { ...m, loading: false, error: next.kind === "refused" ? next.message : SEARCH_COPY.moreFailed };
      const seen = new Set(m.jobs.map(jobKey));
      return { key, jobs: [...m.jobs, ...next.jobs.filter((j) => !seen.has(jobKey(j)))], loading: false };
    });
  }

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
  const shown = outcome?.kind === "result" ? [...outcome.jobs, ...(more.key === requestKey ? more.jobs : [])] : [];
  const paging = more.key === requestKey ? more : { loading: false, error: undefined };
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
            {/* Adding is also beside the label, so it is seen without opening the menu (user, 2026-10-26) */}
            <Field id="role-company" label={SEARCH_COPY.companyLabel} action={
              <Button variant="ghost" aria-expanded={panel === ADD} onClick={() => setPanel(ADD)} className="-my-2.5 -mr-4">
                {SEARCH_COPY.addLink}
              </Button>
            }>
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

      {/* Adding opens over the page, not as a new part under the card (user, 2026-10-26) */}
      <Dialog open={panel === ADD} title={SEARCH_COPY.addTitle} closeLabel={SEARCH_COPY.done} onClose={() => setPanel(null)}>
        <AddCompany followed={new Set(companies.map(companyKey))} prominent={false} nameLabel={SEARCH_COPY.nameLabel} onAdd={addAndChoose} />
      </Dialog>

      {panel === MANAGE && (
        <section ref={panelRef} aria-label={SEARCH_COPY.manageTitle}
          className="flex flex-col gap-4 border-b-2 border-wash-strong pb-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-ink">{SEARCH_COPY.manageTitle}</h2>
            <Button variant="ghost" className="ml-auto" onClick={() => setPanel(null)}>{SEARCH_COPY.done}</Button>
          </div>
          <CompanyList companies={companies} openRoles={openRoles} onRemove={onRemove} />
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
      {shown.length > 0 && (
        <ul ref={listRef} className="flex flex-col">
          {shown.map((job) => (
            <JobRow key={jobKey(job)} job={job} saved={saved.has(jobKey(job))} onSave={onSave} />
          ))}
        </ul>
      )}
      {outcome?.kind === "result" && outcome.total > shown.length && (
        <div className="flex flex-col items-center gap-3 pb-4">
          <p role="status" className="font-bold text-muted">{moreLine(shown.length, outcome.total)}</p>
          {paging.error && <p role="alert" className="font-semibold text-danger">{paging.error}</p>}
          <Button variant="secondary" disabled={paging.loading} onClick={() => void showMore(shown.length)}>
            {paging.loading ? SEARCH_COPY.loadingMore : showMoreLabel(outcome.total - shown.length, PAGE_SIZE)}
          </Button>
        </div>
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
    </>
  );
}
