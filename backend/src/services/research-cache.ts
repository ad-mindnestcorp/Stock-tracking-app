const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const researchCache = new Map<string, CacheEntry>();

export function getCached(key: string): unknown | null {
  const entry = researchCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  researchCache.delete(key);
  return null;
}

export function setCached(key: string, data: unknown): void {
  researchCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}
