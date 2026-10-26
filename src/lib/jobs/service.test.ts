import { describe, expect, it, vi } from "vitest";
import { cachedBoards, readName, readQuery, rowToCompany, searchCompanies, summarize, MAX_RESULTS } from "./service";
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

  it("sends at most a page of results, and says how many there were", async () => {
    const many = Array.from({ length: MAX_RESULTS + 20 }, (_, i) => job(String(i), "Engineer"));
    const result = await searchCompanies([companies[0]], "", async () => found(many));
    expect(result.jobs).toHaveLength(MAX_RESULTS);
    expect(result.total).toBe(MAX_RESULTS + 20);
  });

  it("answers with nothing when no company is followed yet", async () => {
    expect(await searchCompanies([], "pm", getBoard)).toEqual({ jobs: [], total: 0, unavailable: [], openRoles: {} });
  });

  it("says how many roles each company has open, or null when its system didn't answer", async () => {
    expect((await searchCompanies(companies, "", getBoard)).openRoles).toEqual({ "greenhouse:figma": 2, "ashby:notion": 1, "lever:palantir": null });
  });
});
