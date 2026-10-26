import { describe, expect, it, vi } from "vitest";
import { jobKey, loadSavedKeys, postedAgo, saveJob, searchRoles, snapshot } from "./saved";
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

/** A stand-in Supabase client that records each call and answers from `rows`, or fails with `code`. */
function fakeDb(rows: unknown[] = [], code: string | null = null) {
  const calls: string[] = [];
  const result = (data: unknown) => (code ? { data: null, error: { code, message: code } } : { data, error: null });
  const db = {
    from(table: string) {
      return {
        select: async () => { calls.push(`select ${table}`); return result(rows); },
        insert: async (row: Record<string, unknown>) => { calls.push(`insert ${table} ${row.job_id}`); return result(null); },
      };
    },
  };
  return { db: db as unknown as Db, calls };
}

describe("saving a job", () => {
  it("knows which jobs are already saved, to show Saved on them", async () => {
    const { db } = fakeDb([{ source: "greenhouse", board_token: "figma", job_id: "5426468004" }, { nope: true }]);
    expect(await loadSavedKeys(db)).toEqual(new Set([jobKey(job)]));
  });

  it("saves a snapshot, without user_id: the database fills it in", async () => {
    const { db, calls } = fakeDb();
    expect(await saveJob(db, job)).toBe("saved");
    expect(calls).toEqual(["insert saved_jobs 5426468004"]);
  });

  it("treats saving the same job twice as saved, and reports other failures", async () => {
    expect(await saveJob(fakeDb([], "23505").db, job)).toBe("saved");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await saveJob(fakeDb([], "08006").db, job)).toBe("failed");
    vi.restoreAllMocks();
  });
});
