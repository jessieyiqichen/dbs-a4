import { describe, expect, it } from "vitest";
import { createRateLimit } from "./rateLimit";

describe("createRateLimit (security review 2026-10-26)", () => {
  it("lets a person make up to the limit in a minute, then says no until the minute has passed", () => {
    let now = 0;
    const allow = createRateLimit({ limit: 3, windowMs: 60_000, now: () => now });
    expect([allow("a"), allow("a"), allow("a"), allow("a")]).toEqual([true, true, true, false]);
    now = 59_999;
    expect(allow("a")).toBe(false);
    now = 60_000;
    expect(allow("a")).toBe(true);
  });

  it("counts each person apart", () => {
    const allow = createRateLimit({ limit: 1, windowMs: 60_000, now: () => 0 });
    expect([allow("a"), allow("b"), allow("a")]).toEqual([true, true, false]);
  });

  it("forgets people who stopped, so memory stays bounded", () => {
    let now = 0;
    const allow = createRateLimit({ limit: 1, windowMs: 1_000, maxKeys: 2, now: () => now });
    allow("a");
    allow("b");
    now = 5_000;
    allow("c");
    expect(allow("a")).toBe(true);
  });
});
