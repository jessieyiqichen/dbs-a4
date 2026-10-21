import { describe, expect, it } from "vitest";
import { fromAshby, fromGreenhouse, fromLever } from "./normalize";

describe("fromGreenhouse", () => {
  const raw = {
    jobs: [
      {
        id: 5448167008,
        title: "Product Manager, Claude",
        company_name: "Anthropic",
        location: { name: "San Francisco, CA | New York City, NY" },
        absolute_url: "https://job-boards.greenhouse.io/anthropic/jobs/5448167008",
        first_published: "2026-10-08T20:23:17-04:00",
        internal_job_id: 4559874008,
      },
    ],
  };

  it("keeps only the fields the page uses, with the id as text", () => {
    expect(fromGreenhouse(raw, "anthropic")).toEqual({
      company: "Anthropic",
      jobs: [
        {
          source: "greenhouse",
          board: "anthropic",
          id: "5448167008",
          title: "Product Manager, Claude",
          company: "Anthropic",
          location: "San Francisco, CA | New York City, NY",
          url: "https://job-boards.greenhouse.io/anthropic/jobs/5448167008",
          postedAt: "2026-10-09T00:23:17.000Z",
        },
      ],
    });
  });

  it("falls back to the board name when there are no jobs to read the company from", () => {
    expect(fromGreenhouse({ jobs: [] }, "figma")).toEqual({ company: "figma", jobs: [] });
  });

  it("skips jobs without a title or with a link that is not https", () => {
    const bad = {
      jobs: [
        { ...raw.jobs[0], title: "" },
        { ...raw.jobs[0], absolute_url: "javascript:alert(1)" },
      ],
    };
    expect(fromGreenhouse(bad, "anthropic")?.jobs).toEqual([]);
  });

  it("returns null when the body is not a job list", () => {
    expect(fromGreenhouse({ status: 404 }, "anthropic")).toBeNull();
    expect(fromGreenhouse("nope", "anthropic")).toBeNull();
  });
});

describe("fromAshby", () => {
  const job = {
    id: "8fb1615c-34bf-47c4-a1d1-b7b2f836bbd3",
    title: "Technical Program Manager, Compute Infrastructure",
    location: "San Francisco",
    secondaryLocations: [{ location: "Seattle" }],
    publishedAt: "2026-03-12T16:38:15.322+00:00",
    isListed: true,
    jobUrl: "https://jobs.ashbyhq.com/openai/8fb1615c-34bf-47c4-a1d1-b7b2f836bbd3",
    descriptionHtml: "<p>long</p>",
  };

  it("joins the main and secondary locations and uses the given company name", () => {
    expect(fromAshby({ jobs: [job] }, "openai", "OpenAI")).toEqual({
      company: "OpenAI",
      jobs: [
        {
          source: "ashby",
          board: "openai",
          id: "8fb1615c-34bf-47c4-a1d1-b7b2f836bbd3",
          title: "Technical Program Manager, Compute Infrastructure",
          company: "OpenAI",
          location: "San Francisco | Seattle",
          url: "https://jobs.ashbyhq.com/openai/8fb1615c-34bf-47c4-a1d1-b7b2f836bbd3",
          postedAt: "2026-03-12T16:38:15.322Z",
        },
      ],
    });
  });

  it("leaves out jobs that are not listed", () => {
    expect(fromAshby({ jobs: [{ ...job, isListed: false }] }, "openai", "OpenAI")?.jobs).toEqual([]);
  });
});

describe("fromLever", () => {
  const posting = {
    id: "6ed76ce8-4156-4b60-b120-403538bd66cd",
    text: "Administrative Business Partner",
    categories: { location: "Singapore, Singapore", allLocations: ["Singapore, Singapore", "London"] },
    createdAt: 1786469891368,
    hostedUrl: "https://jobs.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd",
    description: "<div>long</div>",
  };

  it("reads the title from text, all locations, and the millisecond date", () => {
    expect(fromLever([posting], "palantir", "Palantir")).toEqual({
      company: "Palantir",
      jobs: [
        {
          source: "lever",
          board: "palantir",
          id: "6ed76ce8-4156-4b60-b120-403538bd66cd",
          title: "Administrative Business Partner",
          company: "Palantir",
          location: "Singapore, Singapore | London",
          url: "https://jobs.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd",
          postedAt: new Date(1786469891368).toISOString(),
        },
      ],
    });
  });

  it("returns null for Lever's not-found body", () => {
    expect(fromLever({ ok: false, error: "Document not found" }, "x", "X")).toBeNull();
  });
});
