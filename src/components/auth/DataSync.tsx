"use client";

import { useSession } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { createBrowserDb } from "@/lib/db/client";
import { connect, disconnect } from "@/lib/store";

/** Connects the goals to Supabase as whoever is signed in. Every request carries their Clerk session token, which is
 *  how the database's row-level security knows whose rows to answer with. Signing out empties the screen's copy. */
export function DataSync() {
  const { isLoaded, session } = useSession();
  // The client asks for a token on each request, so it reads the current session rather than the one it started with
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) return disconnect();
    connect(userId, () => createBrowserDb(async () => (await sessionRef.current?.getToken()) ?? null));
  }, [isLoaded, userId]);
  return null;
}
