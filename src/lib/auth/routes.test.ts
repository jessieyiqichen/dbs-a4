import { describe, expect, it } from "vitest";
import { isPublicPath } from "./routes";

describe("isPublicPath: which pages a signed-out visitor may open", () => {
  it("opens the sign-in and sign-up pages, with every step Clerk adds under them", () => {
    for (const path of ["/sign-in", "/sign-in/factor-one", "/sign-in/sso-callback", "/sign-up", "/sign-up/verify-email-address"]) {
      expect(isPublicPath(path), path).toBe(true);
    }
  });

  it("closes every page that shows a person's goals", () => {
    for (const path of ["/", "/goals", "/goals/new", "/session", "/reminders", "/progress/abc"]) {
      expect(isPublicPath(path), path).toBe(false);
    }
  });

  it("does not open a page that only starts with the same letters", () => {
    for (const path of ["/sign-inside", "/sign-up-later", "/goals/sign-in"]) {
      expect(isPublicPath(path), path).toBe(false);
    }
  });
});
