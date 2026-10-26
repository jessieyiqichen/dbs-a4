import { describe, expect, it, vi } from "vitest";
import { candidates, fetchBoard, findCompany, matchJobs } from "./boards";
import type { BoardResult, Job, Source } from "./types";

describe("candidates", () => {
  it("turns a company name into board names to try", () => {
    expect(candidates("Scale AI")).toEqual([{ token: "scaleai" }, { token: "scale-ai" }]);
    expect(candidates("  Figma ")).toEqual([{ token: "figma" }]);
  });

  it("reads the source and board from a job link", () => {
    expect(candidates("https://job-boards.greenhouse.io/figma/jobs/123")).toEqual([
      { source: "greenhouse", token: "figma" },
    ]);
    expect(candidates("boards.greenhouse.io/stripe")).toEqual([{ source: "greenhouse", token: "stripe" }]);
    expect(candidates("https://jobs.ashbyhq.com/openai/8fb1")).toEqual([{ source: "ashby", token: "openai" }]);
    expect(candidates("https://jobs.lever.co/palantir")).toEqual([{ source: "lever", token: "palantir" }]);
  });

  it("returns nothing for input that cannot be a board name", () => {
    expect(candidates("")).toEqual([]);
    expect(candidates("../../admin")).toEqual([{ token: "admin" }]);
    expect(candidates("https://evil.example.com/figma")).toEqual([]);
    expect(candidates("x".repeat(65))).toEqual([]);
  });
});

function reply(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

const greenhouseBody = {
  jobs: [
    {
      id: 1,
      title: "Product Manager",
      company_name: "Figma",
      location: { name: "San Francisco, CA" },
      absolute_url: "https://job-boards.greenhouse.io/figma/jobs/1",
      first_published: "2026-10-01T00:00:00Z",
    },
  ],
};

describe("fetchBoard", () => {
  it("asks the right address for each source", async () => {
    const fetcher = vi.fn(() => reply(404, {}));
    await fetchBoard("greenhouse", "figma", "Figma", fetcher);
    await fetchBoard("ashby", "openai", "OpenAI", fetcher);
    await fetchBoard("lever", "palantir", "Palantir", fetcher);
    expect(fetcher.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      "https://boards-api.greenhouse.io/v1/boards/figma/jobs",
      "https://api.ashbyhq.com/posting-api/job-board/openai",
      "https://api.lever.co/v0/postings/palantir?mode=json",
    ]);
  });

  it("says found, not found or unavailable", async () => {
    expect(await fetchBoard("greenhouse", "figma", "Figma", () => reply(200, greenhouseBody))).toMatchObject({
      kind: "found",
      company: "Figma",
      jobs: [{ id: "1", title: "Product Manager" }],
    });
    expect(await fetchBoard("greenhouse", "nope", "Nope", () => reply(404, { error: "Job not found" }))).toEqual({
      kind: "not-found",
    });
    expect(await fetchBoard("greenhouse", "figma", "Figma", () => reply(503, {}))).toEqual({ kind: "unavailable" });
    expect(await fetchBoard("greenhouse", "figma", "Figma", () => Promise.reject(new Error("timeout")))).toEqual({
      kind: "unavailable",
    });
    expect(await fetchBoard("greenhouse", "figma", "Figma", () => reply(200, "<html>"))).toEqual({
      kind: "unavailable",
    });
  });
});

describe("findCompany", () => {
  it("asks every system at once, and still prefers Greenhouse, then Ashby, then Lever", async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    // Lever answers first, but Greenhouse has the company too and comes first in the order
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("greenhouse")) return wait(30).then(() => reply(200, greenhouseBody));
      if (url.includes("lever")) return reply(200, [{ id: "l", text: "PM", hostedUrl: "https://jobs.lever.co/figma/l", categories: {} }]);
      return reply(404, {});
    });
    expect(await findCompany("Figma", fetcher)).toMatchObject({ kind: "found", source: "greenhouse" });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("answers about as fast as the slowest board, not the sum of all of them (user, 2026-10-26)", async () => {
    const slow404 = () => new Promise<Response>((resolve) => setTimeout(() => resolve(new Response("{}", { status: 404 })), 50));
    const started = Date.now();
    // Two board names, three systems: six questions
    expect(await findCompany("Hudson River", slow404)).toEqual({ kind: "not-found" });
    expect(Date.now() - started).toBeLessThan(200);
  });

  it("passes over an empty board for one that has jobs, and keeps the empty one if that is all there is", async () => {
    // Webflow and Squarespace left empty Greenhouse boards behind when they moved to another system.
    const moved = (url: string) => (url.includes("greenhouse") ? reply(200, { jobs: [] }) : reply(200, { jobs: [{ id: "a", title: "PM", jobUrl: "https://jobs.ashbyhq.com/webflow/a" }] }));
    expect(await findCompany("Webflow", moved)).toMatchObject({ kind: "found", source: "ashby", jobs: [{ id: "a" }] });
    const empty = (url: string) => (url.includes("greenhouse") ? reply(200, { jobs: [] }) : reply(404, {}));
    expect(await findCompany("Webflow", empty)).toMatchObject({ kind: "found", source: "greenhouse", jobs: [] });
  });

  it("only asks the source a link points to", async () => {
    const fetcher = vi.fn(() => reply(200, greenhouseBody));
    await findCompany("https://job-boards.greenhouse.io/figma", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("names a company found from a link by its board name, written like a name", async () => {
    const getBoard = vi.fn(async (source: Source, token: string, label: string): Promise<BoardResult> =>
      ({ kind: "found", source, board: token, company: label, jobs: [] }));
    await findCompany("https://jobs.lever.co/spotify/3b5f", fetch, getBoard);
    expect(getBoard).toHaveBeenCalledWith("lever", "spotify", "Spotify");
    await findCompany("jobs.ashbyhq.com/scale-ai", fetch, getBoard);
    expect(getBoard).toHaveBeenLastCalledWith("ashby", "scale-ai", "Scale Ai");
  });

  it("is not found when no source has it, and unavailable when a source could not answer", async () => {
    expect(await findCompany("Google", () => reply(404, {}))).toEqual({ kind: "not-found" });
    expect(await findCompany("Google", (url: string) => (url.includes("lever") ? reply(500, {}) : reply(404, {})))).toEqual({
      kind: "unavailable",
    });
  });

  it("is not found for input with no possible board name, without asking anyone", async () => {
    const fetcher = vi.fn(() => reply(200, greenhouseBody));
    expect(await findCompany("!!!", fetcher)).toEqual({ kind: "not-found" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("matchJobs", () => {
  const job = (title: string): Job => ({
    source: "greenhouse",
    board: "figma",
    id: title,
    title,
    company: "Figma",
    location: "",
    url: "https://x",
    postedAt: null,
  });
  const jobs = [job("Product Manager, AI"), job("Senior Software Engineer"), job("Associate Product Manager")];

  it("keeps titles that contain every word, ignoring case", () => {
    expect(matchJobs(jobs, "product manager").map((j) => j.title)).toEqual([
      "Product Manager, AI",
      "Associate Product Manager",
    ]);
    expect(matchJobs(jobs, "  ASSOCIATE  ").map((j) => j.title)).toEqual(["Associate Product Manager"]);
  });

  it("keeps everything for an empty search", () => {
    expect(matchJobs(jobs, " ")).toHaveLength(3);
  });

  it("matches whole words, which may add a common ending (user, 2026-10-26)", () => {
    const titles = [
      "Manager, Software Engineering - Production Engineering",
      "Senior Product Managers",
      "Engineering Manager",
      "Software Engineer",
      "Productivity Lead",
      "Staff Engineer (C++)",
    ];
    const titlesFor = (query: string) => matchJobs(titles.map(job), query).map((j) => j.title);
    // "product" no longer finds "Production" or "Productivity"
    expect(titlesFor("product manager")).toEqual(["Senior Product Managers"]);
    // "engineer" still finds "Engineering" and "Engineers"
    expect(titlesFor("engineer")).toEqual([
      "Manager, Software Engineering - Production Engineering", "Engineering Manager", "Software Engineer", "Staff Engineer (C++)",
    ]);
    // Searching with punctuation or symbols never breaks the search
    expect(titlesFor("c++")).toEqual(["Staff Engineer (C++)"]);
    expect(titlesFor("manager,")).toHaveLength(3);
  });
});
