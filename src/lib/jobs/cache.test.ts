import { describe, expect, it } from "vitest";
import { createCache } from "./cache";

describe("createCache", () => {
  it("keeps a value until it is older than the time limit", () => {
    let now = 0;
    const cache = createCache<string>({ ttlMs: 1000, maxEntries: 10, now: () => now });
    cache.set("figma", "jobs");
    now = 999;
    expect(cache.get("figma")).toBe("jobs");
    now = 1000;
    expect(cache.get("figma")).toBeUndefined();
  });

  it("drops the oldest entry when full, so memory stays bounded", () => {
    const cache = createCache<number>({ ttlMs: 1000, maxEntries: 2, now: () => 0 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  it("refreshes an entry that is set again", () => {
    let now = 0;
    const cache = createCache<number>({ ttlMs: 1000, maxEntries: 2, now: () => now });
    cache.set("a", 1);
    now = 900;
    cache.set("a", 2);
    now = 1500;
    expect(cache.get("a")).toBe(2);
  });
});
