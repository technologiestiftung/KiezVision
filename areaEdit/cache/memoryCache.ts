import type { AreaEditCache } from '../types';

interface Entry {
  dataUrl: string;
  expiresAt?: number;
}

export interface MemoryCacheOptions {
  maxEntries?: number;
  /** TTL in ms; omit for no TTL. */
  ttlMs?: number;
}

/** In-memory LRU. Browser-only; swap for IndexedDB/service worker cache for persistence. */
export function createMemoryAreaEditCache(options: MemoryCacheOptions = {}): AreaEditCache & { stats(): { entries: number } } {
  const maxEntries = options.maxEntries ?? 24;
  const ttlMs = options.ttlMs;
  const map = new Map<string, Entry>();

  const pruneExpired = () => {
    const now = Date.now();
    for (const [k, v] of map.entries()) {
      if (v.expiresAt != null && v.expiresAt < now) map.delete(k);
    }
  };

  const touch = (key: string, entry: Entry) => {
    map.delete(key);
    map.set(key, entry);
    while (map.size > maxEntries) {
      const first = map.keys().next().value;
      if (!first) break;
      map.delete(first);
    }
  };

  return {
    stats() {
      pruneExpired();
      return { entries: map.size };
    },
    get(key: string): string | undefined {
      pruneExpired();
      const e = map.get(key);
      if (!e) return undefined;
      if (e.expiresAt != null && e.expiresAt < Date.now()) {
        map.delete(key);
        return undefined;
      }
      touch(key, e);
      return e.dataUrl;
    },
    set(key: string, dataUrl: string): void {
      pruneExpired();
      const expiresAt = ttlMs != null ? Date.now() + ttlMs : undefined;
      touch(key, { dataUrl, expiresAt });
    },
  };
}
