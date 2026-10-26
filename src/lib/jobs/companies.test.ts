import { describe, expect, it, vi } from "vitest";
import { follow, lookupCompany, loadFollowed, refollow, rowToFollowed, SUGGESTED, unfollow, type FollowedCompany } from "./companies";
import type { Db } from "../db/remote";

const figma: FollowedCompany = { id: "c1", source: "greenhouse", board: "figma", name: "Figma", addedAt: "2026-10-26T10:00:00.000Z" };
const figmaRow = { id: "c1", source: "greenhouse", board_token: "figma", name: "Figma", added_at: "2026-10-26T10:00:00+00:00" };
const answer = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("rowToFollowed", () => {
  it("reads a followed company row", () => {
    expect(rowToFollowed(figmaRow)).toEqual(figma);
  });

  it("drops a row with the wrong shape", () => {
    expect(rowToFollowed({ ...figmaRow, source: "workday" })).toBeNull();
    expect(rowToFollowed({ ...figmaRow, board_token: "Figma Inc" })).toBeNull();
  });
});

describe("SUGGESTED", () => {
  it("offers eight companies across the three hiring systems, each with a safe board name", () => {
    expect(SUGGESTED).toHaveLength(8);
    expect(new Set(SUGGESTED.map((c) => c.source))).toEqual(new Set(["greenhouse", "ashby", "lever"]));
    for (const c of SUGGESTED) expect(c.board).toMatch(/^[a-z0-9-]{1,64}$/);
  });
});

describe("lookupCompany", () => {
  it("asks our server, not the job boards, and passes the name safely", async () => {
    const fetcher = vi.fn(() => answer(200, { kind: "found", source: "greenhouse", board: "figma", company: "Figma", openRoles: 139 }));
    expect(await lookupCompany("Figma & Co", fetcher)).toMatchObject({ kind: "found", openRoles: 139 });
    expect(fetcher).toHaveBeenCalledWith("/api/jobs/company?name=Figma+%26+Co");
  });

  it("passes on not found and unavailable", async () => {
    expect(await lookupCompany("Google", () => answer(200, { kind: "not-found" }))).toEqual({ kind: "not-found" });
    expect(await lookupCompany("Uber", () => answer(200, { kind: "unavailable" }))).toEqual({ kind: "unavailable" });
  });

  it("says so when there were too many lookups in a minute", async () => {
    expect(await lookupCompany("Figma", () => answer(429, { error: "slow down" }))).toEqual({ kind: "too-many" });
  });

  it("treats a broken or strange answer as the systems being unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await lookupCompany("Figma", () => answer(500, {}))).toEqual({ kind: "unavailable" });
    expect(await lookupCompany("Figma", () => answer(200, { kind: "found" }))).toEqual({ kind: "unavailable" });
    expect(await lookupCompany("Figma", () => Promise.reject(new Error("offline")))).toEqual({ kind: "unavailable" });
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
        select: () => ({ order: async () => { calls.push(`select ${table}`); return result(rows); } }),
        insert: (row: Record<string, unknown>) => {
          calls.push(`insert ${table} ${JSON.stringify(row)}`);
          return { select: () => ({ single: async () => result(figmaRow) }) };
        },
        delete: () => ({ eq: async (_: string, id: string) => { calls.push(`delete ${table} ${id}`); return result(null); } }),
      };
    },
  };
  return { db: db as unknown as Db, calls };
}

describe("saving followed companies", () => {
  it("loads the person's companies, oldest first, skipping unreadable rows", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = fakeDb([figmaRow, { id: "bad" }]);
    expect(await loadFollowed(db)).toEqual([figma]);
    vi.restoreAllMocks();
  });

  it("follows a company without sending user_id: the database fills it in", async () => {
    const { db, calls } = fakeDb();
    expect(await follow(db, { source: "greenhouse", board: "figma", name: "Figma" })).toEqual({ kind: "followed", company: figma });
    expect(calls[0]).toBe('insert companies {"source":"greenhouse","board_token":"figma","name":"Figma"}');
  });

  it("says so when the company is already followed (the table allows one of each)", async () => {
    const { db } = fakeDb([], "23505");
    expect(await follow(db, { source: "greenhouse", board: "figma", name: "Figma" })).toEqual({ kind: "already" });
  });

  it("says so when the 25-company limit is reached (the database refuses a 26th)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = fakeDb([], "P0001");
    expect(await follow(db, { source: "greenhouse", board: "figma", name: "Figma" })).toEqual({ kind: "limit" });
    vi.restoreAllMocks();
  });

  it("reports other failures so the page can say it didn't save", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = fakeDb([], "08006");
    expect(await follow(db, { source: "greenhouse", board: "figma", name: "Figma" })).toEqual({ kind: "failed" });
    expect(await unfollow(db, "c1")).toBe(false);
    vi.restoreAllMocks();
  });

  it("removes a company, and Undo puts the same row back", async () => {
    const { db, calls } = fakeDb();
    expect(await unfollow(db, "c1")).toBe(true);
    expect(await refollow(db, figma)).toBe(true);
    expect(calls).toEqual([
      "delete companies c1",
      'insert companies {"id":"c1","source":"greenhouse","board_token":"figma","name":"Figma","added_at":"2026-10-26T10:00:00.000Z"}',
    ]);
  });
});
