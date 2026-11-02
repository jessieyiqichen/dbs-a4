import { describe, expect, it } from "vitest";
import { isSearching, readSearch, searchHref } from "./searchUrl";

const params = (query: string) => new URLSearchParams(query);

describe("readSearch: the Jobs search kept in the address (teacher, 2026-10-28: no way back after a search)", () => {
  it("reads the title, company, page and view", () => {
    expect(readSearch(params("q=product+manager&company=greenhouse:figma&page=3&view=saved"))).toEqual({
      q: "product manager", company: "greenhouse:figma", page: 2, view: "saved",
    });
  });

  it("starts with no search on page 1 of all companies", () => {
    expect(readSearch(params(""))).toEqual({ q: "", company: "", page: 0, view: "search" });
  });

  it("drops anything that is not a search it could have made", () => {
    expect(readSearch(params(`q=${"x".repeat(101)}`)).q).toBe("");
    expect(readSearch(params("company=evil.com:figma")).company).toBe("");
    expect(readSearch(params("company=greenhouse:../admin")).company).toBe("");
    expect(readSearch(params("page=0")).page).toBe(0);
    expect(readSearch(params("page=-2")).page).toBe(0);
    expect(readSearch(params("page=2.5")).page).toBe(0);
    expect(readSearch(params("page=99999")).page).toBe(0);
    expect(readSearch(params("view=admin")).view).toBe("search");
  });
});

describe("searchHref", () => {
  it("writes only what is set, with the page counted from 1", () => {
    expect(searchHref({ q: "", company: "", page: 0, view: "search" })).toBe("/jobs");
    expect(searchHref({ q: "product manager", company: "ashby:openai", page: 1, view: "search" })).toBe(
      "/jobs?q=product+manager&company=ashby%3Aopenai&page=2",
    );
    expect(searchHref({ q: "", company: "", page: 0, view: "saved" })).toBe("/jobs?view=saved");
  });

  it("reads back what it wrote", () => {
    const state = { q: "data & AI", company: "lever:palantir", page: 4, view: "search" as const };
    expect(readSearch(new URL(`https://x${searchHref(state)}`).searchParams)).toEqual(state);
  });
});

describe("isSearching: when Clear search shows", () => {
  it("is true once a title, a company or a later page is chosen", () => {
    expect(isSearching({ q: "", company: "", page: 0 })).toBe(false);
    expect(isSearching({ q: "pm", company: "", page: 0 })).toBe(true);
    expect(isSearching({ q: "", company: "ashby:openai", page: 0 })).toBe(true);
    expect(isSearching({ q: "", company: "", page: 2 })).toBe(true);
  });
});
