"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

/** The core needs only: today's task, and your goals. Reminders are a setting, reached from Goals and the done screen. */
const LINKS = [
  { href: "/", label: "Today", also: ["/session"] },
  { href: "/goals", label: "Goals", also: ["/reminders"] },
];

function isCurrent({ href, also }: (typeof LINKS)[number], pathname: string | null): boolean {
  if (pathname === null) return false;
  if (href === "/") return pathname === "/" || also.includes(pathname);
  return [href, ...also].some((p) => pathname.startsWith(p));
}

/** The links themselves; `pathname` is null while it isn't known yet (prerender fallback). */
export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Main">
      <ul className="flex gap-1 lg:gap-2">
        {LINKS.map((link) => {
          const { href, label } = link;
          const current = isCurrent(link, pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={
                  // A size up on a desktop, so the navigation reads at the scale of the 48px headings under it (user, 2026-10-19)
                  "inline-flex min-h-11 items-center rounded-lg px-3 font-semibold focus-visible:outline-3 focus-visible:outline-focus lg:min-h-12 lg:rounded-xl lg:px-5 lg:text-xl " +
                  (current ? "bg-wash text-ink underline decoration-2 underline-offset-4" : "text-muted hover:text-ink")
                }
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** On Today, the sections appear once there is a goal: a first visit has nothing behind Goals or Reminders yet,
 *  so it shows only the one thing to do. */
export function Nav() {
  const pathname = usePathname();
  const store = useStore();
  const hasGoals = store?.kind === "ready" ? store.data.goals.length > 0 : store?.kind === "load-failed";
  if (pathname === "/" && !hasGoals) return null;
  return <NavLinks pathname={pathname} />;
}
