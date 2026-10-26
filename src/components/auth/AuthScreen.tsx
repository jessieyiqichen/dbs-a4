import type { ReactNode } from "react";
import { CatArt } from "@/components/today/CatArt";
import { AUTH_INTRO } from "@/lib/auth/copy";

/** Sign in and sign up: Titi waves and says in one line what Nudge is, so a classmate opening the link knows before
 *  making an account (user, 2026-10-25). Clerk's form is the one button; there is no navigation until you are in. */
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-4 pb-12 lg:max-w-6xl lg:px-8">
      <header className="flex min-h-11 items-center py-4 lg:pb-2 lg:pt-6">
        <span className="font-display text-2xl font-bold text-ink lg:text-4xl">Nudge</span>
      </header>
      <main id="main" className="grid flex-1 content-start gap-4 lg:grid-cols-2 lg:content-center lg:items-center lg:gap-16">
        <div className="flex items-end gap-2 lg:flex-col lg:items-start lg:gap-6">
          <CatArt mood="wave" className="w-28 shrink-0 lg:w-72" />
          <p className="flat bubble-phone-only mb-6 rounded-2xl rounded-bl-sm bg-surface px-4 py-3 font-display text-lg font-semibold leading-snug text-ink lg:mb-0 lg:bg-transparent lg:p-0 lg:text-3xl lg:font-bold lg:[text-wrap:balance]">
            {AUTH_INTRO}
          </p>
        </div>
        <div className="mx-auto w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
