"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { lookupCompany } from "@/lib/jobs/companies";
import { addLabel, alreadyLine, foundLine, JOBS_COPY } from "@/lib/jobs/copy";
import { companyKey, type Company, type CompanySummary } from "@/lib/jobs/service";

type Found = Extract<CompanySummary, { kind: "found" }>;
type Step =
  | { kind: "idle" }
  | { kind: "looking" }
  | { kind: "found"; company: Found }
  | { kind: "not-found" }
  | { kind: "unavailable" }
  | { kind: "already"; name: string };

interface AddCompanyProps {
  followed: Set<string>;
  onAdd: (company: Company) => Promise<"followed" | "already" | "failed">;
}

/** Type a name, see what was found, then Add: nothing is followed until the person has seen which company it is, so a
 *  different company with the same name is never added by surprise (AGENTS.md). */
export function AddCompany({ followed, onAdd }: AddCompanyProps) {
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [error, setError] = useState<{ field: "name" | "link"; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  async function find(input: string, field: "name" | "link") {
    if (input.trim() === "") {
      setError({ field, text: field === "name" ? JOBS_COPY.emptyName : JOBS_COPY.emptyLink });
      // Back to the field that needs fixing, as on every form here
      (field === "name" ? nameRef : linkRef).current?.focus();
      return;
    }
    setError(null);
    setStep({ kind: "looking" });
    const result = await lookupCompany(input.trim());
    if (result.kind === "found" && followed.has(companyKey(result))) setStep({ kind: "already", name: result.company });
    else if (result.kind === "found") setStep({ kind: "found", company: result });
    else setStep(result);
  }

  async function add(company: Found) {
    setAdding(true);
    const outcome = await onAdd({ source: company.source, board: company.board, name: company.company });
    setAdding(false);
    if (outcome === "failed") return setError({ field: "name", text: JOBS_COPY.saveFailed });
    if (outcome === "already") return setStep({ kind: "already", name: company.company });
    setName("");
    setLink("");
    setStep({ kind: "idle" });
  }

  function submitName(event: FormEvent) {
    event.preventDefault();
    void find(name, "name");
  }

  function submitLink(event: FormEvent) {
    event.preventDefault();
    void find(link, "link");
  }
  const looking = step.kind === "looking";
  // One green button at a time: Find, until something is found and Add takes over (or the link field is the next step)
  const findVariant = step.kind === "found" || step.kind === "not-found" ? "secondary" : "primary";

  return (
    <section className="flex flex-col gap-4">
      <form onSubmit={submitName} className="flex flex-col gap-3" noValidate>
        <Field id="company-name" label={JOBS_COPY.addLabel} error={error?.field === "name" ? error.text : undefined}>
          {(control) => (
            <TextInput {...control} ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder={JOBS_COPY.addPlaceholder} autoComplete="organization" maxLength={200} />
          )}
        </Field>
        <Button type="submit" variant={findVariant} disabled={looking} className="w-full">
          {looking ? JOBS_COPY.looking : JOBS_COPY.find}
        </Button>
      </form>
      <div role="status" aria-live="polite" className="flex flex-col gap-3">
        {looking && <p className="font-bold text-muted">{JOBS_COPY.checking}</p>}
        {step.kind === "found" && (
          <>
            <p className="font-bold text-ink">{foundLine(step.company.company, step.company.source, step.company.openRoles)}</p>
            <Button onClick={() => void add(step.company)} disabled={adding} className="w-full">{addLabel(step.company.company)}</Button>
          </>
        )}
        {step.kind === "already" && <p className="font-bold text-ink">{alreadyLine(step.name)}</p>}
        {step.kind === "unavailable" && <p className="font-semibold text-danger">{JOBS_COPY.unavailable}</p>}
        {step.kind === "not-found" && <p className="font-semibold text-danger">{JOBS_COPY.notFound}</p>}
      </div>
      {step.kind === "not-found" && (
        <form onSubmit={submitLink} className="flex flex-col gap-3" noValidate>
          <Field id="company-link" label={JOBS_COPY.linkLabel} error={error?.field === "link" ? error.text : undefined}>
            {(control) => (
              <TextInput {...control} ref={linkRef} value={link} onChange={(e) => setLink(e.target.value)} placeholder={JOBS_COPY.linkPlaceholder} type="url" inputMode="url" maxLength={200} />
            )}
          </Field>
          <Button type="submit" className="w-full">{JOBS_COPY.find}</Button>
        </form>
      )}
    </section>
  );
}
