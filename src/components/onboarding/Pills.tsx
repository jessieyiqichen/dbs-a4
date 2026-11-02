"use client";

export interface Pill {
  value: string;
  label: string;
  /** A second, quieter part, e.g. "By Nov 18" or "5 a day". */
  detail?: string;
  /** Read out with the choice, for one that opens a field below it (screen readers only). */
  hint?: string;
}

interface Props {
  name: string;
  legend: string;
  /** The question is already asked aloud (Titi's bubble), so the legend is for screen readers only. */
  hideLegend?: boolean;
  options: Pill[];
  /** The answer picked, or "" before one is (teacher, 2026-10-28: nothing starts picked). With `multiple`, every
   *  answer picked. */
  value: string | string[];
  /** The answer tapped; with `multiple`, tapping a picked one again takes it off. */
  onChange: (value: string) => void;
  /** Checkboxes instead of radio buttons, for a question with more than one answer (teacher, 2026-10-28). */
  multiple?: boolean;
  /** Set on the fieldset, so an unanswered row can be scrolled to and its first answer focused. */
  id?: string;
  error?: string;
}

/** One question as a row of one-tap answers: real radio buttons (arrow keys move between them), or checkboxes when more
 *  than one answer fits, drawn as clay pills. The chosen ones are pale green with a tick, so it never rests on colour
 *  alone. */
export function Pills({ name, legend, hideLegend = false, options, value, onChange, multiple = false, id, error }: Props) {
  const errorId = error && id ? `${id}-error` : undefined;
  return (
    <fieldset id={id} aria-describedby={errorId} data-field>
      <legend className={hideLegend ? "sr-only" : "mb-2 font-display text-lg font-semibold text-ink lg:mb-3 lg:text-xl"}>{legend}</legend>
      {error && (
        <p id={errorId} className="mb-2 flex items-start gap-1.5 text-sm font-semibold text-danger">
          <span aria-hidden="true" className="mt-px inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-danger text-[11px] text-on-primary">
            !
          </span>
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = Array.isArray(value) ? value.includes(o.value) : o.value === value;
          return (
            <label
              key={o.value}
              className={`clay clay-press inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 font-display font-semibold text-ink lg:min-h-12 lg:px-5 lg:text-lg ${
                on ? "bg-primary-soft [--lip:var(--color-lip)]" : "bg-surface hover:bg-wash"
              }`}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={name}
                value={o.value}
                checked={on}
                onChange={() => onChange(o.value)}
                aria-describedby={o.hint ? `${name}-${o.value}-hint` : undefined}
                className="sr-only"
              />
              {on && <span aria-hidden="true">✓</span>}
              <span>{o.label}</span>
              {o.detail && <span className="font-sans text-sm font-bold text-muted">{o.detail}</span>}
              {o.hint && <span id={`${name}-${o.value}-hint`} className="sr-only">{o.hint}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
