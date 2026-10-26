"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Toast } from "@/components/ui/Toast";
import type { FollowedCompany } from "@/lib/jobs/companies";
import { addedLine, JOBS_COPY, removedLine } from "@/lib/jobs/copy";
import { companyKey, type Company } from "@/lib/jobs/service";
import { AddCompany } from "./AddCompany";
import { JobSearch } from "./JobSearch";
import { CompanyList } from "./CompanyList";
import { SuggestedCompanies } from "./SuggestedCompanies";
import { useCompanies } from "./useCompanies";
import { useSavedJobs } from "./useSavedJobs";

// The page's heading is "Jobs" (read out, not shown: the tab already says it); "Your companies" heads its own part
const HEADER = <PageHeader title={JOBS_COPY.title} intro={JOBS_COPY.intro} back={null} level="h2" />;
// With no companies yet Titi asks the same thing in her bubble, so the line under the heading would say it twice
const EMPTY_HEADER = <PageHeader title={JOBS_COPY.title} back={null} level="h2" />;

type Notice = { text: string; undo?: FollowedCompany } | null;

/** Jobs: search the followed companies' roles and save them (6c), and the companies themselves (6b). On a phone the
 *  search comes first, since coming back that's what people do most (user, 2026-10-26); on a desktop the companies
 *  are on the left and the search on the right. */
export function JobsScreen() {
  const { state, retry, add, remove, undoRemove } = useCompanies();
  const { saved, save } = useSavedJobs();
  const [openRoles, setOpenRoles] = useState<Record<string, number | null>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const closeNotice = useCallback(() => setNotice(null), []);

  async function addCompany(company: Company) {
    setBusy(true);
    setError(null);
    const result = await add(company);
    setBusy(false);
    if (result.kind === "followed") setNotice({ text: addedLine(result.company.name) });
    if (result.kind === "failed") setError(JOBS_COPY.saveFailed);
    return result.kind;
  }

  async function removeCompany(company: FollowedCompany) {
    setError(null);
    if (await remove(company)) setNotice({ text: removedLine(company.name), undo: company });
    else setError(JOBS_COPY.saveFailed);
  }

  async function undo(company: FollowedCompany) {
    setNotice(null);
    if (!(await undoRemove(company))) setError(JOBS_COPY.saveFailed);
  }

  if (state.kind === "loading") return <>{HEADER}<p className="pt-6 text-muted">Loading your companies…</p></>;
  if (state.kind === "load-failed") {
    return (
      <>
        {HEADER}
        <section role="alert" className="mt-6 flex flex-col gap-4 rounded-lg border-2 border-danger p-4">
          <h2 className="text-xl font-bold text-ink">{JOBS_COPY.loadFailed.title}</h2>
          <p className="text-ink">{JOBS_COPY.loadFailed.next}</p>
          <div><Button variant="secondary" onClick={retry}>Try again</Button></div>
        </section>
      </>
    );
  }

  const { companies } = state;
  const followed = new Set(companies.map(companyKey));
  return (
    // Search comes first in the page itself, not just on screen, so keyboard and screen-reader order match what a
    // phone shows; on a desktop it is placed in the right-hand column
    <div className="flex flex-col gap-10 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8">
      <h1 className="sr-only">Jobs</h1>
      {companies.length > 0 && (
        <div className="pt-4 lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:pt-0">
          <JobSearch companies={companies} saved={saved} onSave={save} onOpenRoles={setOpenRoles} />
        </div>
      )}
      <div className="flex flex-col gap-6 lg:col-span-5 lg:col-start-1 lg:row-start-1">
        {companies.length === 0 ? EMPTY_HEADER : HEADER}
        {error && <p role="alert" className="font-semibold text-danger">{error}</p>}
        {companies.length === 0 ? (
          <SuggestedCompanies onAdd={(c) => void addCompany(c)} busy={busy} />
        ) : (
          <CompanyList companies={companies} openRoles={openRoles} onRemove={(c) => void removeCompany(c)} />
        )}
        <AddCompany followed={followed} prominent={companies.length === 0} onAdd={addCompany} />
      </div>
      <Toast
        message={notice?.text ?? null}
        onUndo={notice?.undo ? () => void undo(notice.undo as FollowedCompany) : undefined}
        onClose={closeNotice}
      />
    </div>
  );
}
