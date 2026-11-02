"use client";

import { fishCount } from "@/lib/session";

/** Up to a dozen, today's number shows as fish treats for Titi; beyond that a bar says it more clearly. */
const MAX_FISH = 12;

/** Fish per row, balanced so 9 sits as 5 + 4, not 8 + 1. */
function perRow(total: number): number {
  const rows = Math.ceil(total / 6);
  return Math.ceil(total / rows);
}

interface Props {
  total: number;
  done: number;
  /** Names the group for screen readers, e.g. "Today". */
  label: string;
  /** When set, each fish past `done` is a button: tapping fish n means "I'm at n now". */
  onPick?: (reached: number) => void;
  /** Off when the number is already shown nearby (the session's bar). */
  showCount?: boolean;
  /** "lg" makes the tiles bigger from 1024px (the session on a desktop); below that both sizes are the same. */
  size?: "md" | "lg";
}

function Fish({ earned }: { earned: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element -- a tiny decorative icon, repeated; no layout shift to manage
  return <img src={earned ? "/cat/fish.png" : "/cat/fish-locked.png"} alt="" aria-hidden="true" className="w-full" />;
}

/** Beyond a dozen, a honey bar says today's number more clearly than fish. */
function FishBar({ total, done, label, count }: { total: number; done: number; label: string; count: React.ReactNode }) {
  const pct = Math.min(100, Math.round((done / Math.max(total, 1)) * 100));
  return (
    <div>
      <div role="img" aria-label={label} className="h-5 overflow-hidden rounded-full bg-reward-soft">
        <div className="h-full rounded-full bg-reward" style={{ width: `${pct}%` }} />
      </div>
      {count}
    </div>
  );
}

/** The tile and grid classes. "lg" tiles grow from 1024px (3rem to 4.5rem, the grid columns follow); below that both sizes match. */
function layout(total: number, big: boolean) {
  const cell = `flex h-12 w-12 items-center justify-center rounded-xl px-1 ${big ? "lg:h-[4.5rem] lg:w-[4.5rem] lg:rounded-2xl lg:px-2" : ""}`;
  return {
    tile: (earned: boolean) => `clay ${cell} ${earned ? "bg-reward-soft [--lip:var(--color-reward)]" : "bg-surface"}`,
    // Display-only fish have no box at all (user, 2026-10-18): a box reads as a tile you could press
    flat: (earned: boolean) => `${cell} ${earned ? "" : "opacity-80"}`,
    grid: { gridTemplateColumns: `repeat(${perRow(total)}, ${big ? "var(--fish-cell)" : "3rem"})` },
    gridClass: `grid gap-x-3 gap-y-3 ${big ? "[--fish-cell:3rem] lg:gap-x-4 lg:gap-y-4 lg:[--fish-cell:4.5rem]" : ""}`,
  };
}

/** Today's number as fish treats you can see fill up, with the count beside them so it never rests on colour alone.
 *  Done past today's number, the extra fish follow on a honey backdrop (teacher, 2026-10-28: extra treats added no fish). */
export function Coins({ total, done, label, onPick, showCount = true, size = "md" }: Props) {
  const line = fishCount(done, total);
  const count = showCount ? <p aria-hidden="true" className="mt-3 font-display text-lg font-semibold tabular-nums text-muted">{line}</p> : null;
  const extra = Math.max(done - total, 0);

  if (total + extra > MAX_FISH) return <FishBar total={total} done={done} label={`${label}: ${line}`} count={count} />;

  // Clay tiles only where a fish can be tapped: an earned one sits on a honey lip, one still to go on a plain lip.
  // Where the fish only show a number (the plan step, Today on a desktop), they stand bare, so nothing looks pressable that isn't.
  const { tile, flat, grid, gridClass } = layout(total + extra, size === "lg");
  const fish = Array.from({ length: total }, (_, i) => i + 1);
  // A soft honey backdrop, not a clay tile, so an extra fish never looks like something to press
  const extras = Array.from({ length: extra }, (_, i) => (
    <span key={`extra-${i}`} className={`${flat(true)} bg-reward-soft`}><Fish earned /></span>
  ));

  if (!onPick) {
    return (
      <div>
        <div role="img" aria-label={`${label}: ${line}`} className={gridClass} style={grid}>
          {fish.map((n) => <span key={n} className={flat(n <= done)}><Fish earned={n <= done} /></span>)}
          {extras}
        </div>
        {count}
      </div>
    );
  }

  return (
    <div>
      <div role="group" aria-label={label} className={gridClass} style={grid}>
        {fish.map((n) =>
          n <= done ? (
            <span key={n} className={tile(true)}><Fish earned /></span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPick(n)}
              aria-label={`I'm at ${n}`}
              // The next fish to tap wears a honey outline, so it is clear where to start (user, 2026-10-18)
              className={`${tile(false)} clay-press hover:bg-wash ${n === done + 1 ? "outline-3 outline-offset-3 outline-reward" : ""}`}
            >
              <Fish earned={false} />
            </button>
          ),
        )}
        {extras}
      </div>
      {count}
    </div>
  );
}
