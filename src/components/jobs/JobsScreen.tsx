"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Toast } from "@/components/ui/Toast";
import type { FollowedCompany } from "@/lib/jobs/companies";
import { addedLine, CHANGE_COPY, JOBS_COPY, removedLine, SAVED_COPY, savedTab, searchingLine } from "@/lib/jobs/copy";
import { savedKeys, retrySaved, saveFoundJob, useSavedJobs } from "@/lib/jobs/savedStore";
import { companyKey, type Company } from "@/lib/jobs/service";
import { useStore } from "@/lib/store";
import { AddCompany } from "./AddCompany";
import { CompanyList } from "./CompanyList";
import { JobSearch } from "./JobSearch";
import { SavedList, type Notify } from "./SavedList";
import { SuggestedCompanies } from "./SuggestedCompanies";
import { useCompanies } from "./useCompanies";

// The page's heading is "Jobs" (read out, not shown: the tab already says it); "Your companies" heads its own part
const HEADER = <PageHeader title={JOBS_COPY.title} intro={JOBS_COPY.intro} back={null} level="h2" />;
// With no companies yet Titi asks the same thing in her bubble, so the line under the heading would say it twice
const EMPTY_HEADER = <PageHeader title={JOBS_COPY.title} back={null} level="h2" />;

type Notice = { text: string; undo?: () => void } | null;
type View = "search" | "saved";

function LoadFailed({ title, next, onRetry }: { title: string; next: string; onRetry: () => void }) {
  return (
    <section role="alert" className="mt-6 flex flex-col gap-4 rounded-lg border-2 border-danger p-4">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <p className="text-ink">{next}</p>
      <div><Button variant="secondary" onClick={onRetry}>Try again</Button></div>
    </section>
  );
}

/** Search | Saved (user, 2026-10-26): one list at a time. The chosen one looks like a selected goal tab. */
function ViewSwitch({ view, savedCount, onChange }: { view: View; savedCount: number | null; onChange: (v: View) => void }) {
  const option = (value: View, label: string) => (
    <Button variant="secondary" aria-pressed={view === value} onClick={() => onChange(value)}
      className={view === value ? "bg-primary-soft [--lip:var(--color-lip)]" : ""}>
      {label}
    </Button>
  );
  return (
    <div role="group" aria-label="Show" className="flex gap-2 pt-4 lg:col-span-12 lg:pt-0">
      {option("search", SAVED_COPY.tabSearch)}
      {/* No count until the list has loaded, so it never reads "Saved 0" by mistake */}
      {option("saved", savedCount === null ? SAVED_COPY.tabSaved : savedTab(savedCount))}
    </div>
  );
}

/** Jobs: search the followed companies' roles and save them (6c), the companies themselves (6b), and the saved list
 *  (6d). On a phone the companies fold into one line above the search; on a desktop they are on the left and the
 *  search on the right. */
export function JobsScreen() {
  const { state, retry, add, remove, undoRemove } = useCompanies();
  const saved = useSavedJobs();
  const store = useStore();
  const [view, setView] = useState<View>("search");
  const [companiesOpen, setCompaniesOpen] = useState(false);
  const [openRoles, setOpenRoles] = useState<Record<string, number | null>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const closeNotice = useCallback(() => setNotice(null), []);
  const notify: Notify = useCallback((text, undo) => setNotice({ text, undo }), []);

  async function addCompany(company: Company) {
    setBusy(true);
    setError(null);
    const result = await add(company);
    setBusy(false);
    if (result.kind === "followed") notify(addedLine(result.company.name));
    if (result.kind === "failed") setError(JOBS_COPY.saveFailed);
    return result.kind;
  }

  async function removeCompany(company: FollowedCompany) {
    setError(null);
    if (await remove(company)) notify(removedLine(company.name), () => void undoRemove(company).then((ok) => ok || setError(JOBS_COPY.saveFailed)));
    else setError(JOBS_COPY.saveFailed);
  }

  if (state.kind === "loading") return <>{HEADER}<p className="pt-6 text-muted">Loading your companies…</p></>;
  if (state.kind === "load-failed") return <>{HEADER}<LoadFailed {...JOBS_COPY.loadFailed} onRetry={retry} /></>;

  const { companies } = state;
  const followed = new Set(companies.map(companyKey));
  const savedJobs = saved.kind === "ready" ? saved.jobs : [];
  const showSwitch = companies.length > 0 || savedJobs.length > 0;
  // Undo does its work and the toast leaves with it
  const undo = notice?.undo;
  const toast = <Toast message={notice?.text ?? null} onUndo={undo ? () => { undo(); setNotice(null); } : undefined} onClose={closeNotice} />;

  if (showSwitch && view === "saved") {
    return (
      <div className="flex flex-col gap-6 lg:max-w-2xl">
        <h1 className="sr-only">Jobs</h1>
        <ViewSwitch view={view} savedCount={saved.kind === "ready" ? savedJobs.length : null} onChange={setView} />
        {saved.kind === "loading" && <p className="text-muted">Loading your saved jobs…</p>}
        {saved.kind === "load-failed" && <LoadFailed {...SAVED_COPY.loadFailed} onRetry={retrySaved} />}
        {saved.kind === "ready" && (
          <SavedList jobs={saved.jobs} closed={saved.closed} goals={store?.kind === "ready" ? store.data.goals : []}
            rememberedGoalId={store?.kind === "ready" ? store.data.settings.applyGoalId : null} notify={notify} />
        )}
        {toast}
      </div>
    );
  }

  // On a phone the companies fold into one line above the search, opened in place with "Change" (user, 2026-10-26: with
  // many roles they were far below). With no companies yet there is nothing to fold. A desktop shows both columns.
  const folded = companies.length > 0 && !companiesOpen;
  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8 lg:gap-y-10">
      <h1 className="sr-only">Jobs</h1>
      {showSwitch && <ViewSwitch view={view} savedCount={saved.kind === "ready" ? savedJobs.length : null} onChange={setView} />}
      <div className="flex flex-col gap-6 lg:col-span-5 lg:col-start-1 lg:row-start-2">
        {companies.length > 0 && (
          <div className="flex items-center justify-between gap-3 lg:hidden">
            <p className="font-bold text-ink">{searchingLine(companies.map((c) => c.name))}</p>
            <Button variant="ghost" aria-expanded={companiesOpen} aria-controls="companies-panel" onClick={() => setCompaniesOpen((o) => !o)}>
              {companiesOpen ? CHANGE_COPY.close : CHANGE_COPY.open}
              <span aria-hidden="true">{companiesOpen ? "▴" : "▾"}</span>
            </Button>
          </div>
        )}
        <div id="companies-panel" className={`${folded ? "hidden lg:flex" : "flex"} flex-col gap-6`}>
          {companies.length === 0 ? EMPTY_HEADER : HEADER}
          {error && <p role="alert" className="font-semibold text-danger">{error}</p>}
          {companies.length === 0 ? (
            <SuggestedCompanies onAdd={(c) => void addCompany(c)} busy={busy} />
          ) : (
            <CompanyList companies={companies} openRoles={openRoles} onRemove={(c) => void removeCompany(c)} />
          )}
          <AddCompany followed={followed} prominent={companies.length === 0} onAdd={addCompany} />
        </div>
      </div>
      {companies.length > 0 && (
        <div className="lg:col-span-7 lg:col-start-6 lg:row-start-2">
          <JobSearch companies={companies} saved={savedKeys(saved)} onSave={saveFoundJob} onOpenRoles={setOpenRoles} />
        </div>
      )}
      {toast}
    </div>
  );
}
