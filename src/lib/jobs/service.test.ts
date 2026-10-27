import { describe, expect, it, vi } from "vitest";
import { cachedBoards, closedJobs, readCompany, readFrom, readName, readQuery, rowToCompany, searchCompanies, summarize, PAGE_SIZE } from "./service";
import type { BoardResult, Job, Source } from "./types";

const job = (id: string, title: string, postedAt: string | null = null): Job => ({
  source: "greenhouse", board: "figma", id, title, company: "Figma", location: "San Francisco", url: `https://job-boards.greenhouse.io/figma/jobs/${id}`, postedAt,
});
const found = (jobs: Job[], company = "Figma"): BoardResult => ({ kind: "found", source: "greenhouse", board: "figma", company, jobs });

describe("reading what the browser sent", () => {
  it("accepts a company name or link of sensible length", () => {
    expect(readName("  Figma ")).toBe("Figma");
    expect(readName("")).toBeNull();
    expect(readName(null)).toBeNull();
    expect(readName("x".repeat(201))).toBeNull();
  });

  it("accepts a chosen company as source:board, or none for all of them, and nothing else", () => {
    expect(readCompany("greenhouse:figma")).toBe("greenhouse:figma");
    expect(readCompany(null)).toBe("");
    expect(readCompany("")).toBe("");
    expect(readCompany("workday:google")).toBeNull();
    expect(readCompany("greenhouse:../admin")).toBeNull();
  });

  it("accepts where the next page starts as a whole number, 0 when missing, and nothing else", () => {
    expect(readFrom(null)).toBe(0);
    expect(readFrom("")).toBe(0);
    expect(readFrom("20")).toBe(20);
    expect(readFrom("-20")).toBeNull();
    expect(readFrom("2.5")).toBeNull();
    expect(readFrom("20abc")).toBeNull();
    expect(readFrom("100000")).toBeNull();
  });

  it("accepts a search of up to 100 characters, and none at all", () => {
    expect(readQuery(" product manager ")).toBe("product manager");
    expect(readQuery(null)).toBe("");
    expect(readQuery("x".repeat(101))).toBeNull();
  });
});

describe("rowToCompany", () => {
  it("reads a followed company from the database", () => {
    expect(rowToCompany({ source: "ashby", board_token: "openai", name: "OpenAI" })).toEqual({ source: "ashby", board: "openai", name: "OpenAI" });
  });

  it("refuses a row that could change the address we call", () => {
    expect(rowToCompany({ source: "ashby", board_token: "../admin", name: "x" })).toBeNull();
    expect(rowToCompany({ source: "workday", board_token: "uber", name: "Uber" })).toBeNull();
  });
});

describe("summarize", () => {
  it("tells the page what was found without sending every job", () => {
    expect(summarize(found([job("1", "Designer"), job("2", "Engineer")]))).toEqual({
      kind: "found", source: "greenhouse", board: "figma", company: "Figma", openRoles: 2,
    });
    expect(summarize({ kind: "not-found" })).toEqual({ kind: "not-found" });
  });
});

describe("cachedBoards", () => {
  it("asks a board once and answers from the cache for 10 minutes", async () => {
    const fetchBoard = vi.fn(async () => found([job("1", "Designer")]));
    const getBoard = cachedBoards(fetchBoard);
    await getBoard("greenhouse", "figma", "Figma");
    await getBoard("greenhouse", "figma", "Figma");
    expect(fetchBoard).toHaveBeenCalledTimes(1);
  });

  it("keeps a not-found answer too, so asking again for a company no system has is instant", async () => {
    const fetchBoard = vi.fn(async (): Promise<BoardResult> => ({ kind: "not-found" }));
    const getBoard = cachedBoards(fetchBoard);
    await getBoard("lever", "google", "Google");
    await getBoard("lever", "google", "Google");
    expect(fetchBoard).toHaveBeenCalledTimes(1);
  });

  it("does not keep an answer that failed, so the next search tries again", async () => {
    const fetchBoard = vi.fn(async (): Promise<BoardResult> => ({ kind: "unavailable" }));
    const getBoard = cachedBoards(fetchBoard);
    await getBoard("lever", "palantir", "Palantir");
    await getBoard("lever", "palantir", "Palantir");
    expect(fetchBoard).toHaveBeenCalledTimes(2);
  });
});

describe("searchCompanies", () => {
  const boards: Record<string, BoardResult> = {
    figma: found([job("1", "Product Manager, Editor", "2026-10-20T00:00:00Z"), job("2", "Product Designer")]),
    notion: { kind: "found", source: "ashby", board: "notion", company: "Notion", jobs: [{ ...job("n1", "Senior Product Manager", "2026-10-25T00:00:00Z"), source: "ashby", board: "notion", company: "Notion" }] },
    palantir: { kind: "unavailable" },
  };
  const getBoard = async (_: Source, token: string) => boards[token];
  const companies = [
    { source: "greenhouse" as const, board: "figma", name: "Figma" },
    { source: "ashby" as const, board: "notion", name: "Notion" },
    { source: "lever" as const, board: "palantir", name: "Palantir" },
  ];

  it("finds matching roles across every followed company, newest first", async () => {
    const result = await searchCompanies(companies, "product manager", getBoard);
    expect(result.jobs.map((j) => j.id)).toEqual(["n1", "1"]);
    expect(result.total).toBe(2);
  });

  it("names the companies whose hiring system didn't answer, and still returns the rest", async () => {
    expect((await searchCompanies(companies, "designer", getBoard)).unavailable).toEqual(["Palantir"]);
  });

  it("sends one page of 20 results, and says how many there were", async () => {
    const many = Array.from({ length: 45 }, (_, i) => job(String(i), "Engineer"));
    const result = await searchCompanies([companies[0]], "", async () => found(many));
    expect(PAGE_SIZE).toBe(20);
    expect(result.jobs.map((j) => j.id)).toEqual(many.slice(0, 20).map((j) => j.id));
    expect(result.total).toBe(45);
  });

  it("sends the next page from where the last one ended, and the rest at the end", async () => {
    const many = Array.from({ length: 45 }, (_, i) => job(String(i), "Engineer"));
    const getBoard = async () => found(many);
    expect((await searchCompanies([companies[0]], "", getBoard, "", 20)).jobs.map((j) => j.id)).toEqual(many.slice(20, 40).map((j) => j.id));
    expect((await searchCompanies([companies[0]], "", getBoard, "", 40)).jobs.map((j) => j.id)).toEqual(["40", "41", "42", "43", "44"]);
    expect((await searchCompanies([companies[0]], "", getBoard, "", 60)).jobs).toEqual([]);
  });

  it("searches only the chosen company, and still counts every company's open roles for the menu", async () => {
    const getBoard = vi.fn(async (_: Source, token: string) => boards[token]);
    const result = await searchCompanies(companies, "product manager", getBoard, "ashby:notion");
    expect(result.jobs.map((j) => j.id)).toEqual(["n1"]);
    expect(result.unavailable).toEqual([]);
    expect(result.openRoles).toEqual({ "greenhouse:figma": 2, "ashby:notion": 1, "lever:palantir": null });
  });

  it("answers with nothing when no company is followed yet", async () => {
    expect(await searchCompanies([], "pm", getBoard)).toEqual({ jobs: [], total: 0, unavailable: [], openRoles: {} });
  });

  it("says how many roles each company has open, or null when its system didn't answer", async () => {
    expect((await searchCompanies(companies, "", getBoard)).openRoles).toEqual({ "greenhouse:figma": 2, "ashby:notion": 1, "lever:palantir": null });
  });
});

describe("closedJobs", () => {
  const saved = [
    { source: "greenhouse" as const, board: "figma", jobId: "1" },
    { source: "greenhouse" as const, board: "figma", jobId: "gone" },
    { source: "lever" as const, board: "palantir", jobId: "p1" },
    { source: "ashby" as const, board: "left-ashby", jobId: "a1" },
  ];
  const boards: Record<string, BoardResult> = {
    figma: found([job("1", "Designer")]),
    palantir: { kind: "unavailable" },
    "left-ashby": { kind: "not-found" },
  };

  it("finds saved jobs that are no longer on their board, asking each board once", async () => {
    const getBoard = vi.fn(async (_: Source, token: string) => boards[token]);
    const result = await closedJobs(saved, getBoard);
    expect(result.closed).toEqual(["greenhouse:figma:gone", "ashby:left-ashby:a1"]);
    expect(getBoard).toHaveBeenCalledTimes(3);
  });

  it("can't tell for a board that didn't answer, so it doesn't call those closed", async () => {
    expect((await closedJobs(saved, async (_: Source, token: string) => boards[token])).unchecked).toEqual(["lever:palantir:p1"]);
  });
});
