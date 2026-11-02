import type { Metadata } from "next";
import { Suspense } from "react";
import { JobsScreen } from "@/components/jobs/JobsScreen";
import { AppShell } from "@/components/ui/AppShell";

export const metadata: Metadata = { title: "Jobs · Nudge" };

export default function JobsPage() {
  return (
    <AppShell>
      {/* The search is read from the address, which is only known in the browser */}
      <Suspense fallback={<p className="pt-6 text-muted">Loading your companies…</p>}>
        <JobsScreen />
      </Suspense>
    </AppShell>
  );
}
