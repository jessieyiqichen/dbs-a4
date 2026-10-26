import { clerkSetup } from "@clerk/testing/playwright";

/** Asks Clerk for a testing token once, so the test browsers aren't stopped by its bot protection. */
export default async function globalSetup() {
  await clerkSetup();
}
