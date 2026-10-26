import { serverDbForRequest } from "@/lib/db/server";
import { getBoard, limits, tooMany } from "@/lib/jobs/server";
import { closedJobs, type SavedRef } from "@/lib/jobs/service";
import { SOURCES, type Source } from "@/lib/jobs/types";

const TOKEN = /^[a-z0-9-]{1,64}$/;

/** GET /api/jobs/saved-status: which of the signed-in person's saved jobs are no longer posted. Their saved jobs are
 *  read from Supabase with their own token (RLS applies); each board comes from the shared 10-minute cache. */
export async function GET() {
  const signedIn = await serverDbForRequest();
  if (!signedIn) return Response.json({ error: "Sign in to check saved jobs" }, { status: 401 });
  if (!limits.savedStatus(signedIn.userId)) return tooMany();
  const { db } = signedIn;
  const { data, error } = await db.from("saved_jobs").select("source, board_token, job_id");
  if (error) {
    console.error("Jobs: could not read saved jobs", error);
    return Response.json({ error: "Your saved jobs didn't load, try again in a moment" }, { status: 502 });
  }
  const saved: SavedRef[] = ((data ?? []) as Record<string, unknown>[])
    .filter((r) => SOURCES.includes(r.source as Source) && typeof r.board_token === "string" && TOKEN.test(r.board_token) && typeof r.job_id === "string")
    .map((r) => ({ source: r.source as Source, board: r.board_token as string, jobId: r.job_id as string }));
  return Response.json(await closedJobs(saved, getBoard));
}
