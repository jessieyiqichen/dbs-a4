"use client";

import { Button } from "@/components/ui/Button";
import { SOURCE_NAMES, type FollowedCompany } from "@/lib/jobs/companies";
import { JOBS_COPY, rolesCount } from "@/lib/jobs/copy";
import { companyKey } from "@/lib/jobs/service";

interface CompanyListProps {
  companies: FollowedCompany[];
  openRoles: Record<string, number | null>;
  onRemove: (company: FollowedCompany) => void;
}

function rolesLine(company: FollowedCompany, openRoles: Record<string, number | null>): string | null {
  const key = companyKey(company);
  if (!(key in openRoles)) return null;
  const count = openRoles[key];
  return count === null ? JOBS_COPY.rolesUnknown : rolesCount(count);
}

/** The followed companies. A row can't be tapped (there is no company page), so it has no clay box, only a hairline
 *  between rows (AGENTS.md: clay means "you can press this"); Remove is the one action, with Undo after. */
export function CompanyList({ companies, openRoles, onRemove }: CompanyListProps) {
  return (
    <ul className="flex flex-col">
      {companies.map((company) => {
        const roles = rolesLine(company, openRoles);
        return (
          <li key={company.id} className="flex items-center justify-between gap-3 border-b-2 border-wash-strong py-3 last:border-b-0">
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold text-ink">{company.name}</p>
              <p className="text-sm font-bold text-muted">
                {SOURCE_NAMES[company.source]}
                {roles && ` · ${roles}`}
              </p>
            </div>
            <Button variant="ghost" onClick={() => onRemove(company)} aria-label={`Remove ${company.name}`}>
              Remove
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
