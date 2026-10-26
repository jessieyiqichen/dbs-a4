"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Toast } from "@/components/ui/Toast";
import type { FollowedCompany } from "@/lib/jobs/companies";
import { addedLine, JOBS_COPY, removedLine } from "@/lib/jobs/copy";
import { companyKey, type Company } from "@/lib/jobs/service";
import { AddCompany } from "./AddCompany";
import { CompanyList } from "./CompanyList";
import { SuggestedCompanies } from "./SuggestedCompanies";
import { useCompanies } from "./useCompanies";

const HEADER = <PageHeader title={JOBS_COPY.title} intro={JOBS_COPY.intro} back={null} />;
// With no companies yet Titi asks the same thing in her bubble, so the line under the heading would say it twice
const EMPTY_HEADER = <PageHeader title={JOBS_COPY.title} back={null} />;

type Notice = { text: string; undo?: FollowedCompany } | null;

/** Jobs (6b): the companies a person follows, and adding more. On a desktop the right column will hold the search (6c). */
export function JobsScreen() {
  const { state, openRoles, retry, add, remove, undoRemove } = useCompanies();
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
    <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8">
      <div className="flex flex-col gap-6 lg:col-span-5">
        {companies.length === 0 ? EMPTY_HEADER : HEADER}
        {error && <p role="alert" className="font-semibold text-danger">{error}</p>}
        {companies.length === 0 ? (
          <SuggestedCompanies onAdd={(c) => void addCompany(c)} busy={busy} />
        ) : (
          <CompanyList companies={companies} openRoles={openRoles} onRemove={(c) => void removeCompany(c)} />
        )}
        <AddCompany followed={followed} onAdd={addCompany} />
      </div>
      <p className="hidden pt-24 text-center font-bold text-muted lg:col-span-7 lg:block">{JOBS_COPY.searchNext}</p>
      <Toast
        message={notice?.text ?? null}
        onUndo={notice?.undo ? () => void undo(notice.undo as FollowedCompany) : undefined}
        onClose={closeNotice}
      />
    </div>
  );
}
