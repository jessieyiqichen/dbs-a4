import type { ComponentProps, ReactNode } from "react";

interface ControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** A small action at the end of the label's line (e.g. "+ Add company"); it never changes the line's height. */
  action?: ReactNode;
  /** Receives the id and aria attributes to spread onto the input. */
  children: (control: ControlProps) => ReactNode;
}

/** A label, an optional hint, the control, and an error that says what to do next. */
export function Field({ id, label, hint, error, action, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="font-semibold text-ink">
          {label}
        </label>
        {action}
      </div>
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-semibold text-danger">
          <span aria-hidden="true" className="mt-px inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-danger text-[11px] text-on-primary">
            !
          </span>
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3 text-base font-bold text-ink shadow-[inset_0_2px_0_rgba(0,0,0,.04)] " +
  "placeholder:font-semibold placeholder:text-muted focus-visible:border-ink focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-focus " +
  "aria-invalid:border-danger";

export function TextInput({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${inputClass} ${className}`} {...props} />;
}
