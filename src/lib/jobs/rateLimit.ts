/** How many requests one person may make in a window (security review, 2026-10-26): each job lookup can make our
 *  server ask three hiring systems, so without a limit one person could hammer them and use up the free tier. Kept in
 *  memory, per running copy of the server, which is enough to stop a loop or a script. */
export function createRateLimit({ limit, windowMs, maxKeys = 5_000, now = Date.now }: { limit: number; windowMs: number; maxKeys?: number; now?: () => number }) {
  const hits = new Map<string, number[]>();
  return function allow(key: string): boolean {
    const at = now();
    const recent = (hits.get(key) ?? []).filter((t) => at - t < windowMs);
    hits.delete(key);
    // People who stopped are forgotten first: a Map keeps insertion order, so the first keys are the oldest
    while (hits.size >= maxKeys) hits.delete(hits.keys().next().value as string);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    hits.set(key, [...recent, at]);
    return true;
  };
}
