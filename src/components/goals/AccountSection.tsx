"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SIGN_IN_PATH } from "@/lib/auth/routes";

/** Who is signed in, and the way out (user, 2026-10-25: a row beside Reminder times and Backup, so the navigation keeps
 *  only Today and Goals). Seldom used, so it stays folded like Backup. */
export function AccountSection() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  async function leave() {
    setPending(true);
    setError(null);
    try {
      await signOut({ redirectUrl: SIGN_IN_PATH });
    } catch (signOutError) {
      console.error("Nudge: sign out failed", signOutError);
      setError("Couldn't sign out, check your connection and try again");
      setPending(false);
    }
  }

  return (
    <details className="group mt-2 rounded-3xl bg-wash px-5 py-3 open:pb-5">
      <summary className="flex cursor-pointer list-none items-center justify-between font-display text-lg font-semibold text-ink focus-visible:outline-3 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
        Account
        <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-90">→</span>
      </summary>
      <div className="mt-3 flex flex-col gap-4">
        {email && (
          <p className="text-sm font-bold text-muted">
            Signed in as <span className="break-all text-ink">{email}</span>
          </p>
        )}
        <Button variant="secondary" className="self-start" onClick={leave} disabled={pending}>
          {pending ? "Signing out…" : "Sign out"}
        </Button>
        {error && <p role="alert" className="text-sm font-bold text-danger">{error}</p>}
      </div>
    </details>
  );
}
