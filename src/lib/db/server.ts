import { auth } from "@clerk/nextjs/server";
import { createBrowserDb } from "./client";
import type { Db } from "./remote";

/** Supabase on the server, as the person who sent the request: their Clerk session token goes with every query, so
 *  row-level security answers with their rows only, exactly as in the browser. Null when nobody is signed in. */
export async function serverDbForRequest(): Promise<Db | null> {
  const { userId, getToken } = await auth();
  if (!userId) return null;
  // Same publishable key as the browser; the server never uses the secret key, so it can't see past RLS either
  return createBrowserDb(() => getToken());
}
