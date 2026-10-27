"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatShortDate } from "@/lib/dates";
import { timeOfDay, weekdayLetter, weekLabel, type BowlDay, type TimeOfDay } from "@/lib/scene";
import type { BowlFill } from "@/lib/session";
import { CatArt, type CatEffect, type CatMood } from "./CatArt";

const TIMES: TimeOfDay[] = ["morning", "dusk", "night"];
const BOWL: Record<BowlFill, string> = { empty: "/cat/bowl-empty.png", some: "/cat/bowl-some.png", full: "/cat/bowl-full.png" };

/** The current hour, refreshed every minute so the window changes while the page stays open. */
function useHour(): number {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = window.setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return hour;
}

/** The window (art generated with GPT) as a short banner: the sky says what time it is, nothing is drawn over it. */
function Window({ time, corner, className = "" }: { time: TimeOfDay; corner?: ReactNode; className?: string }) {
  return (
    <div className={`relative aspect-[1040/457] w-full overflow-hidden rounded-3xl bg-wash short:aspect-[1040/240] compact:aspect-[1040/400] ${className}`}>
      {TIMES.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element -- three paintings cross-fade; next/image would reload on each swap
        <img key={t} src={`/cat/window-${t}.webp`} alt="" aria-hidden="true" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 motion-reduce:transition-none ${t === time ? "opacity-100" : "opacity-0"}`} />
      ))}
      {corner && <div className="absolute left-3 top-3">{corner}</div>}
      {/* The "morning" painting is the daytime sky (5:00 to 15:59), so it is read out as daytime */}
      <span className="sr-only">Titi&apos;s window, {time === "morning" ? "daytime" : time}</span>
    </div>
  );
}

/** One bowl on a shelf; labelled by weekday letter on Today, by day of the month in the diary. */
export function ShelfBowl({ bowl, label = "letter", pop = false }: { bowl: BowlDay; label?: "letter" | "day"; pop?: boolean }) {
  const { letter, name } = weekdayLetter(bowl.date);
  const text = label === "letter" ? letter : String(Number(bowl.date.slice(8)));
  const said = bowl.future ? "not yet" : bowl.before ? "before you started" : bowl.fill === "full" ? "all done" : bowl.fill === "some" ? "some done" : "nothing yet";
  return (
    <li className={`relative flex flex-1 flex-col items-center ${pop ? "badge-in" : ""}`} style={pop ? { ["--delay" as string]: "0.6s" } : undefined}>
      {/* Only the bowl fades for a day not yet come or before the goal existed; the day label keeps its contrast */}
      {/* eslint-disable-next-line @next/next/no-img-element -- painted art */}
      <img src={BOWL[bowl.fill]} alt="" aria-hidden="true" className={`relative w-full max-w-11 drop-shadow-[0_3px_2px_rgba(90,60,20,.25)] ${bowl.future || bowl.before ? "opacity-45" : ""}`} />
      {/* Today wears a small honey tag under its bowl, like the date on a calendar */}
      <span aria-hidden="true" className={`mt-1 min-w-5 rounded-full px-1.5 text-center text-[11px] font-extrabold leading-5 ${bowl.today ? "bg-reward text-ink shadow-[0_2px_0_var(--color-reward-deep)]" : "text-muted"}`}>{text}</span>
      <span className="sr-only">{bowl.today ? "Today" : `${name} ${formatShortDate(bowl.date)}`}: {said}</span>
    </li>
  );
}

/** This week as seven of Titi's bowls on a clay shelf: fish in the days that got something, heaped when the day was done.
 *  On a phone the shelf stays at the foot of the screen while the room scrolls (status, not navigation: nothing on it is a
 *  button), with its small heading, "Titi's week, 3 of 7 days", shown there too (user, 2026-10-19); from 640px up it
 *  sits in the page under the room, and on a desktop it is the floor of Titi's room. */
function Shelf({ bowls, className = "" }: { bowls: BowlDay[]; className?: string }) {
  return (
    <div className={`fixed inset-x-0 bottom-0 z-20 border-t-2 border-reward-soft bg-page/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:pb-0 sm:backdrop-blur-none ${className}`}>
      <div className="mx-auto max-w-xl px-3 pb-1 pt-1.5 sm:pb-2 sm:pt-2 lg:mx-0 lg:max-w-none lg:px-1">
        <p id="titi-week" className="mb-0.5 text-center text-[11px] font-extrabold leading-4 text-muted sm:mb-1 sm:text-xs lg:mb-2 lg:text-left lg:text-sm">{weekLabel(bowls)}</p>
        <ol aria-labelledby="titi-week" className="flex items-end gap-1 lg:gap-3 lg:[&_img]:max-w-16 lg:[&_li>span:first-of-type]:text-xs lg:[&_li>span:first-of-type]:leading-6 lg:[&_li>span:first-of-type]:min-w-6">
          {bowls.map((b) => <ShelfBowl key={b.date} bowl={b} />)}
        </ol>
      </div>
    </div>
  );
}

interface Props {
  bowls: BowlDay[];
  cat: { mood: CatMood; effect?: CatEffect; key?: string };
  corner?: ReactNode;
  /** What Titi says when you come back ("Welcome back, yesterday counted!"), in a bubble beside her. */
  say?: string | null;
  /** Today's goal and its one button, placed right under Titi. */
  children?: ReactNode;
}

/** Titi's room, in layers that never overlap: the window banner, Titi with her drawn animations on a clay mat, the goal
 *  and its button, and the week's bowls on a shelf. Each piece is whole art or plain interface, so nothing is stitched.
 *  On a phone the shelf is fixed at the foot of the screen, so Titi stays big and the button still lands on the first
 *  screen (user, 2026-10-18: Titi is the design, she must be seen).
 *  From 1024px it is task first (reviewer's plan A, chosen by the user on 2026-10-19): a 12-column grid, the goal, its
 *  button and the week's bowls on the left seven columns, Titi's scene on the right five, every column top-aligned so
 *  nothing is stretched to match a neighbour. Below 1024px the page looks as before. */
export function Room({ bowls, cat, corner, say = null, children }: Props) {
  const time = timeOfDay(useHour());
  return (
    <div className="flex flex-col gap-4 max-sm:pb-24 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8 lg:gap-y-6">
      {/* Titi's scene: on a phone the window and Titi head the page as before. On a desktop it is the right five columns,
          exactly as tall as the task column (user, 2026-10-19: the two sides must line up): the window starts level with
          the goal tabs at one fixed size in every state (user, 2026-10-19: it grew and shrank with the left column), and
          Titi with what she says comes straight under it, bigger, so her words are seen early. Two whole paintings, never
          stitched */}
      <div className="contents lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-6 lg:self-stretch">
        <Window time={time} corner={corner} className="lg:aspect-[1040/620]" />
        {/* Coming back, Titi says hello in a bubble beside her, so the greeting is hers and not one more grey line
            (user, 2026-10-19: the welcome was too quiet) */}
        <div className={`flex items-end justify-center lg:-mb-3 lg:mt-auto ${say ? "gap-1" : ""}`}>
          <div className={`relative flex flex-col items-center ${say ? "w-44 shrink-0 short:w-28 compact:w-36 lg:w-64" : "mx-auto w-52 short:w-32 compact:w-40 lg:w-72"}`}>
            <span aria-hidden="true" className={`clay absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-sun [--lip:#e9cf7e] ${say ? "h-10 w-40 short:h-6 short:w-24 compact:w-28 lg:bottom-3 lg:h-11 lg:w-52" : "h-10 w-48 short:h-6 short:w-28 compact:w-32 lg:bottom-3 lg:h-12 lg:w-60"}`} />
            <CatArt key={cat.key} mood={cat.mood} effect={cat.effect} sun={false} className={`relative ${say ? "w-40 short:w-20 compact:w-32 lg:w-60" : "w-40 short:w-20 compact:w-32 lg:w-56"}`} />
          </div>
          {say && (
            <p className="flat badge-in mb-12 max-w-44 rounded-2xl rounded-bl-sm bg-surface px-4 py-3 font-display text-lg font-semibold leading-snug text-ink short:mb-8 short:text-base lg:mb-24 lg:max-w-60 lg:text-2xl" style={{ ["--delay" as string]: "0.3s" }}>
              {say}
            </p>
          )}
        </div>
      </div>
      {/* The task: on a phone the goal, then the shelf fixed at the foot of the screen; on a desktop the left seven
          columns, top-aligned, with the week's bowls as a row under the button (not pinned) */}
      <div className="flex flex-col gap-4 lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:gap-6">
        {children}
      </div>
      <Shelf bowls={bowls} className="lg:col-span-7 lg:col-start-1 lg:row-start-2" />
    </div>
  );
}

/** While the saved data loads (a moment): the room's shapes, quiet, so nothing jumps when it arrives. */
export function RoomSkeleton() {
  const block = "animate-pulse rounded-3xl bg-wash motion-reduce:animate-none";
  return (
    <div aria-busy="true" aria-label="Loading your goals" className="flex flex-col gap-4 pt-2">
      <div className={`${block} aspect-[1040/457] w-full`} />
      <div className={`${block} mx-auto h-40 w-40 rounded-full`} />
      <div className={`${block} h-10 w-56 rounded-full`} />
      <div className={`${block} h-20 w-full`} />
      <div className={`${block} h-14 w-full rounded-2xl`} />
    </div>
  );
}
