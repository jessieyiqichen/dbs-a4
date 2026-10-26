import type { NextConfig } from "next";

/** Security review (2026-10-26): no other site may show these pages in a frame (clickjacking), the browser doesn't
 *  guess file types, other sites only learn our origin when a link is followed, and camera, mic and location are off.
 *  A strict Content-Security-Policy is left for later: Clerk's sign-in loads its own scripts, and a wrong policy would
 *  break signing in (see log.md). */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Both experimental flags are off on purpose: with them on, a client-side navigation away from Today left the old
  // page mounted under the new one (two <main> elements). Verified 2026-10-18 by toggling each and counting <main>.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
