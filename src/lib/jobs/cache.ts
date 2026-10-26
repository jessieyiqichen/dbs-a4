/** A small in-memory cache with a time limit and a size cap. On Vercel each running copy of the server keeps its own,
 *  which is fine here: it only saves repeat downloads of the same board within a few minutes. */
export interface Cache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
}

export function createCache<T>({ ttlMs, maxEntries, now = Date.now }: { ttlMs: number; maxEntries: number; now?: () => number }): Cache<T> {
  // A Map remembers insertion order, so the first key is always the oldest
  const entries = new Map<string, { value: T; at: number }>();
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (now() - entry.at < ttlMs) return entry.value;
      entries.delete(key);
      return undefined;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, { value, at: now() });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value as string);
    },
  };
}
