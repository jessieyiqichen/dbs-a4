"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Toast } from "@/components/ui/Toast";
import type { FollowedCompany } from "@/lib/jobs/companies";
import { addedLine, JOBS_COPY, removedLine, SAVED_COPY, savedTab, SEARCH_COPY } from "@/lib/jobs/copy";
import { savedKeys, retrySaved, saveFoundJob, useSavedJobs } from "@/lib/jobs/savedStore";
import type { Company } from "@/lib/jobs/service";
import { useStore } from "@/lib/store";
import { AddCompany } from "./AddCompany";
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

/** Search | Saved (user, 2026-10-26): one list at a time. The chosen one looks like a selected goal tab. With Search
 *  showing, "+ Add company" sits at the end of the row, seen without opening the company menu and clear of the card. */
function ViewSwitch({ view, savedCount, onChange, action }: { view: View; savedCount: number | null; onChange: (v: View) => void; action?: ReactNode }) {
  const option = (value: View, label: string) => (
    // "Show …" for screen readers: the search card has its own Search button, and two buttons with one name are a guess
    <Button variant="secondary" aria-pressed={view === value} aria-label={`Show ${label}`} onClick={() => onChange(value)}
      className={view === value ? "bg-primary-soft [--lip:var(--color-lip)]" : ""}>
      {label}
    </Button>
  );
  return (
    <div className="flex items-center gap-2 pt-4 lg:col-span-12 lg:pt-0">
      <div role="group" aria-label="Show" className="flex gap-2">
        {option("search", SAVED_COPY.tabSearch)}
        {/* No count until the list has loaded, so it never reads "Saved 0" by mistake */}
        {option("saved", savedCount === null ? SAVED_COPY.tabSaved : savedTab(savedCount))}
      </div>
      {action}
    </div>
  );
}

/** Jobs: search the followed companies' roles and save them, with the companies kept in the search's company menu, and
 *  the saved list behind the Search | Saved switch. */
export function JobsScreen() {
  const { state, retry, add, remove, undoRemove } = useCompanies();
  const saved = useSavedJobs();
  const store = useStore();
  const [view, setView] = useState<View>("search");
  const [notice, setNotice] = useState<Notice>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
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

  // No companies yet: Titi's suggestions and Add, since there is nothing to search. Then the search card, whose company
  // menu holds adding and managing them (user, 2026-10-26: no fold line, no left column)
  return (
    <div className="flex flex-col gap-6 lg:max-w-4xl">
      <h1 className="sr-only">Jobs</h1>
      {showSwitch && (
        <ViewSwitch view={view} savedCount={saved.kind === "ready" ? savedJobs.length : null} onChange={setView}
          action={companies.length > 0 && (
            <Button variant="ghost" aria-haspopup="dialog" className="-mr-4 ml-auto whitespace-nowrap" onClick={() => setAdding(true)}>
              {SEARCH_COPY.addLink}
            </Button>
          )} />
      )}
      {error && <p role="alert" className="font-semibold text-danger">{error}</p>}
      {companies.length === 0 ? (
        <div className="flex flex-col gap-6 lg:max-w-xl">
          {EMPTY_HEADER}
          <SuggestedCompanies onAdd={(c) => void addCompany(c)} busy={busy} />
          <AddCompany followed={new Set()} prominent onAdd={addCompany} />
        </div>
      ) : (
        <JobSearch companies={companies} saved={savedKeys(saved)} adding={adding} onAdding={setAdding} onSave={saveFoundJob} onAdd={addCompany} onRemove={(c) => void removeCompany(c)} />
      )}
      {toast}
    </div>
  );
}
