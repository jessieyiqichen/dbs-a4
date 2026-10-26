import type { Metadata } from "next";
import { JobsScreen } from "@/components/jobs/JobsScreen";
import { AppShell } from "@/components/ui/AppShell";

export const metadata: Metadata = { title: "Jobs · Nudge" };

export default function JobsPage() {
  return (
    <AppShell>
      <JobsScreen />
    </AppShell>
  );
}
