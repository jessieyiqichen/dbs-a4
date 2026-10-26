import { describe, expect, it, vi } from "vitest";
import { jobKey, loadSaved, postedAgo, removeSaved, restoreSaved, rowToSaved, saveJob, savedKey, searchRoles, setApplied, snapshot, type SavedJob } from "./saved";
import type { Db } from "../db/remote";
import type { Job } from "./types";

const job: Job = {
  source: "greenhouse", board: "figma", id: "5426468004", title: "Account Executive, Enterprise", company: "Figma",
  location: "San Francisco, CA • New York, NY", url: "https://boards.greenhouse.io/figma/jobs/5426468004", postedAt: "2025-01-28T23:57:29.000Z",
};
const answer = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("snapshot", () => {
  it("keeps what the saved list needs, so it stays readable after the posting is taken down", () => {
    expect(snapshot(job)).toEqual({
      source: "greenhouse", board_token: "figma", job_id: "5426468004", title: "Account Executive, Enterprise", company_name: "Figma",
      location: "San Francisco, CA • New York, NY", url: "https://boards.greenhouse.io/figma/jobs/5426468004", posted_at: "2025-01-28T23:57:29.000Z",
    });
  });

  it("fits the table's limits: no location is null, and very long fields are cut", () => {
    expect(snapshot({ ...job, location: "" }).location).toBeNull();
    expect(snapshot({ ...job, location: "x".repeat(900) }).location).toHaveLength(500);
    expect(snapshot({ ...job, title: "t".repeat(400) }).title).toHaveLength(300);
  });
});

describe("postedAgo", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  it("says how long ago a job was posted, in words", () => {
    expect(postedAgo("2026-10-26T08:00:00Z", now)).toBe("today");
    expect(postedAgo("2026-10-25T08:00:00Z", now)).toBe("yesterday");
    expect(postedAgo("2026-10-21T08:00:00Z", now)).toBe("5 days ago");
    expect(postedAgo("2026-10-05T08:00:00Z", now)).toBe("3 weeks ago");
    expect(postedAgo("2026-07-01T08:00:00Z", now)).toBe("3 months ago");
    expect(postedAgo("2025-01-28T23:57:29Z", now)).toBe("over a year ago");
  });

  it("says nothing when the board gave no date", () => {
    expect(postedAgo(null, now)).toBeNull();
  });
});

describe("searchRoles", () => {
  it("asks our server with the search in the address, safely encoded", async () => {
    const fetcher = vi.fn(() => answer(200, { jobs: [job], total: 1, unavailable: [], openRoles: { "greenhouse:figma": 139 } }));
    expect(await searchRoles("sales & ops", fetcher)).toMatchObject({ kind: "result", total: 1, jobs: [job] });
    expect(fetcher).toHaveBeenCalledWith("/api/jobs/search?q=sales+%26+ops");
  });

  it("drops a job with the wrong shape or a link that isn't https", async () => {
    const fetcher = () => answer(200, { jobs: [job, { ...job, id: "x", url: "javascript:alert(1)" }, { title: 3 }], total: 3, unavailable: [], openRoles: {} });
    expect((await searchRoles("", fetcher)).kind === "result" && (await searchRoles("", fetcher))).toMatchObject({ jobs: [job] });
  });

  it("reports the server's own message for a refused search, and a plain failure otherwise", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await searchRoles("x".repeat(101), () => answer(400, { error: "Keep the search under 100 characters" }))).toEqual({ kind: "refused", message: "Keep the search under 100 characters" });
    expect(await searchRoles("pm", () => answer(502, {}))).toEqual({ kind: "failed" });
    expect(await searchRoles("pm", () => Promise.reject(new Error("offline")))).toEqual({ kind: "failed" });
    vi.restoreAllMocks();
  });
});

const savedRow = {
  id: "s1", source: "greenhouse", board_token: "figma", job_id: "5426468004", title: "Account Executive, Enterprise", company_name: "Figma",
  location: "San Francisco, CA • New York, NY", url: "https://boards.greenhouse.io/figma/jobs/5426468004", posted_at: "2025-01-28T23:57:29+00:00",
  status: "saved", saved_at: "2026-10-26T15:00:00+00:00", applied_at: null,
};
const saved: SavedJob = {
  id: "s1", source: "greenhouse", board: "figma", jobId: "5426468004", title: "Account Executive, Enterprise", company: "Figma",
  location: "San Francisco, CA • New York, NY", url: "https://boards.greenhouse.io/figma/jobs/5426468004", postedAt: "2025-01-28T23:57:29.000Z",
  status: "saved", savedAt: "2026-10-26T15:00:00.000Z", appliedAt: null,
};

describe("rowToSaved", () => {
  it("reads a saved job row", () => {
    expect(rowToSaved(savedRow)).toEqual(saved);
    expect(rowToSaved({ ...savedRow, status: "applied", applied_at: "2026-10-26T16:00:00+00:00" })).toMatchObject({ status: "applied", appliedAt: "2026-10-26T16:00:00.000Z" });
  });

  it("drops a row with the wrong shape or a link that isn't https", () => {
    expect(rowToSaved({ ...savedRow, status: "maybe" })).toBeNull();
    expect(rowToSaved({ ...savedRow, url: "http://example.com" })).toBeNull();
  });

  it("matches the job it was saved from", () => {
    expect(savedKey(saved)).toBe(jobKey(job));
  });
});

/** A stand-in Supabase client that records each call and answers with `rows`, or fails with `code`. */
function fakeDb(rows: unknown[] = [], code: string | null = null) {
  const calls: string[] = [];
  const result = (data: unknown) => (code ? { data: null, error: { code, message: code } } : { data, error: null });
  const db = {
    from(table: string) {
      return {
        select: () => ({ order: async () => { calls.push(`select ${table}`); return result(rows); } }),
        insert: (row: Record<string, unknown>) => {
          calls.push(`insert ${table} ${row.job_id}${row.id ? ` as ${row.id}` : ""}`);
          const answer = result(rows[0] ?? null);
          return { select: () => ({ single: async () => answer }), then: (resolve: (v: unknown) => void) => resolve(answer) };
        },
        update: (change: Record<string, unknown>) => ({ eq: async (_: string, id: string) => { calls.push(`update ${table} ${id} ${change.status} ${change.applied_at}`); return result(null); } }),
        delete: () => ({ eq: async (_: string, id: string) => { calls.push(`delete ${table} ${id}`); return result(null); } }),
      };
    },
  };
  return { db: db as unknown as Db, calls };
}

describe("the saved list in the database", () => {
  it("loads saved jobs, newest first, skipping unreadable rows", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await loadSaved(fakeDb([savedRow, { id: 1 }]).db)).toEqual([saved]);
    vi.restoreAllMocks();
  });

  it("saves a snapshot, without user_id (the database fills it in), and hands back the saved row", async () => {
    const { db, calls } = fakeDb([savedRow]);
    expect(await saveJob(db, job)).toEqual({ kind: "saved", saved });
    expect(calls).toEqual(["insert saved_jobs 5426468004"]);
  });

  it("says when the job was already saved (another tab, a double tap), and reports other failures", async () => {
    expect(await saveJob(fakeDb([], "23505").db, job)).toEqual({ kind: "already" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await saveJob(fakeDb([], "08006").db, job)).toEqual({ kind: "failed" });
    vi.restoreAllMocks();
  });

  it("marks a job applied with the time, and back to saved", async () => {
    const { db, calls } = fakeDb();
    expect(await setApplied(db, "s1", "2026-10-26T16:00:00.000Z")).toBe(true);
    expect(await setApplied(db, "s1", null)).toBe(true);
    expect(calls).toEqual(["update saved_jobs s1 applied 2026-10-26T16:00:00.000Z", "update saved_jobs s1 saved null"]);
  });

  it("removes a saved job, and Undo puts the same row back", async () => {
    const { db, calls } = fakeDb();
    expect(await removeSaved(db, "s1")).toBe(true);
    expect(await restoreSaved(db, saved)).toBe(true);
    expect(calls).toEqual(["delete saved_jobs s1", "insert saved_jobs 5426468004 as s1"]);
  });
});
