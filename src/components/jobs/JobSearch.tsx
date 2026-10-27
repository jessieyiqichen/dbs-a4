"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Select, TextInput } from "@/components/ui/Field";
import type { FollowedCompany } from "@/lib/jobs/companies";
import {
  allCompaniesOption, companyOption, lookingLine, noMatchLine, pageLine, resultsLine, SEARCH_COPY, someDownLine,
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
  /** The add dialog, opened from "+ Add company" beside the Search | Saved switch or from the company menu. */
  adding: boolean;
  onAdding: (open: boolean) => void;
  onSave: (job: Job) => Promise<boolean>;
  onAdd: (company: Company) => Promise<"followed" | "already" | "limit" | "failed">;
  onRemove: (company: FollowedCompany) => void;
}

/** The Jobs search (user, 2026-10-26): one card with a job title, a company menu and Search, in one row on a desktop
 *  and two on a phone. The menu is the browser's own (keyboard, screen readers and phones' pickers come with it): all
 *  companies, each one with its open roles, then "+ Add a company…" (the add dialog) and "Manage companies…" (a panel
 *  under the card). Before anything is typed it shows the newest roles, so people can browse; 20 a page, with
 *  Previous and Next under the list (user, 2026-10-26). */
export function JobSearch({ companies, saved, adding, onAdding, onSave, onAdd, onRemove }: JobSearchProps) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [chosen, setChosen] = useState("");
  const [managing, setManaging] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [attempt, setAttempt] = useState(0);
  const [openRoles, setOpenRoles] = useState<Record<string, number | null>>({});
  const panelRef = useRef<HTMLElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const turnedPage = useRef(false);
  // A company that was removed is no longer a choice: back to all of them
  const only = companies.some((c) => companyKey(c) === chosen) ? chosen : "";
  // The page belongs to its search: a new search, company or retry starts again on page 1
  const searchKey = `${companies.map((c) => c.id).join(",")}|${submitted}|${only}|${attempt}`;
  const [paging, setPaging] = useState({ key: "", page: 0 });
  const page = paging.key === searchKey ? paging.page : 0;
  // Each answer remembers which request it belongs to, so "loading" is simply "no answer for this request yet"
  const requestKey = `${searchKey}|${page}`;
  const [answer, setAnswer] = useState<{ key: string; outcome: SearchOutcome } | null>(null);

  useEffect(() => {
    let live = true;
    searchRoles(submitted, fetch, only, page * PAGE_SIZE).then((outcome) => {
      if (!live) return;
      setAnswer({ key: requestKey, outcome });
      if (outcome.kind === "result") setOpenRoles(outcome.openRoles);
    });
    return () => {
      live = false;
    };
  }, [requestKey, submitted, only, page]);

  // Managing opens a panel under the card, which takes the focus (the first Remove), so keyboard users land in it
  useEffect(() => {
    const box = panelRef.current;
    if (managing && box) (box.querySelector<HTMLElement>("li button") ?? box.querySelector<HTMLElement>("button"))?.focus();
  }, [managing]);

  const outcome = answer?.key === requestKey ? answer.outcome : null;
  // A new page starts at the top of the list, and the focus goes there too, so the next Tab is its first role
  useEffect(() => {
    if (!outcome || !turnedPage.current) return;
    turnedPage.current = false;
    resultsRef.current?.focus({ preventScroll: true });
  }, [outcome]);

  function goTo(next: number) {
    turnedPage.current = true;
    setPaging({ key: searchKey, page: next });
    resultsRef.current?.scrollIntoView({ block: "start" });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length > MAX_QUERY) return setError("Keep the search under 100 characters");
    setError(undefined);
    setSubmitted(trimmed);
  }

  // Choosing a company searches it right away; the two actions open the add dialog or the panel, and leave the choice
  function choose(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (value === ADD) return onAdding(true);
    if (value === MANAGE) return setManaging(true);
    setChosen(value === ALL ? "" : value);
  }

  async function addAndChoose(company: Company) {
    const result = await onAdd(company);
    if (result === "followed") {
      setChosen(companyKey(company));
      onAdding(false);
    }
    return result;
  }

  const names = (only ? companies.filter((c) => companyKey(c) === only) : companies).map((c) => c.name);
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

      {/* Adding opens over the page, not as a new part under the card (user, 2026-10-26) */}
      <Dialog open={adding} title={SEARCH_COPY.addTitle} closeLabel={SEARCH_COPY.done} onClose={() => onAdding(false)}>
        <AddCompany followed={new Set(companies.map(companyKey))} prominent={false} nameLabel={SEARCH_COPY.nameLabel} onAdd={addAndChoose} />
      </Dialog>

      {managing && (
        <section ref={panelRef} aria-label={SEARCH_COPY.manageTitle}
          className="flex flex-col gap-4 border-b-2 border-wash-strong pb-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-ink">{SEARCH_COPY.manageTitle}</h2>
            <Button variant="ghost" className="ml-auto" onClick={() => setManaging(false)}>{SEARCH_COPY.done}</Button>
          </div>
          <CompanyList companies={companies} openRoles={openRoles} onRemove={onRemove} />
        </section>
      )}

      <div ref={resultsRef} tabIndex={-1} role="status" aria-live="polite" className="flex scroll-mt-4 flex-col gap-1 font-bold outline-none">
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
      {outcome?.kind === "result" && (
        <Pager page={page} pages={Math.ceil(outcome.total / PAGE_SIZE)} onGo={goTo} />
      )}
    </section>
  );
}

/** Previous and Next under the list, with where you are; none when everything fits on one page. */
function Pager({ page, pages, onGo }: { page: number; pages: number; onGo: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label={SEARCH_COPY.pagesLabel} className="flex items-center justify-between gap-3 pb-4">
      {page > 0 ? <Button variant="secondary" onClick={() => onGo(page - 1)}>{SEARCH_COPY.previous}</Button> : <span />}
      <p className="font-bold text-muted">{pageLine(page + 1, pages)}</p>
      {page < pages - 1 ? <Button variant="secondary" onClick={() => onGo(page + 1)}>{SEARCH_COPY.next}</Button> : <span />}
    </nav>
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
