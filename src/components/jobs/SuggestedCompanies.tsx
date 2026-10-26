"use client";

import { CatArt } from "@/components/today/CatArt";
import { Button } from "@/components/ui/Button";
import { SUGGESTED } from "@/lib/jobs/companies";
import { JOBS_COPY } from "@/lib/jobs/copy";
import type { Company } from "@/lib/jobs/service";

/** An empty list: Titi asks, and eight companies are one tap each (AGENTS.md). Nothing is saved until one is tapped. */
export function SuggestedCompanies({ onAdd, busy }: { onAdd: (company: Company) => void; busy: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <CatArt mood="idle" className="w-24 shrink-0" />
        <p className="flat mb-4 rounded-2xl rounded-bl-sm bg-surface px-4 py-3 font-display text-lg font-semibold leading-snug text-ink">
          {JOBS_COPY.emptyBubble}
        </p>
      </div>
      <p className="font-bold text-muted">{JOBS_COPY.suggestedLabel}</p>
      <ul className="flex flex-wrap gap-2">
        {SUGGESTED.map((company) => (
          <li key={`${company.source}:${company.board}`}>
            <Button variant="secondary" disabled={busy} onClick={() => onAdd(company)} aria-label={`Add ${company.name}`}>
              + {company.name}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
