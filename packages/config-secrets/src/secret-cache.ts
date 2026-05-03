export interface SecretCacheOptions {
  readonly defaultTtlMs?: number;
  readonly maxEntries?: number;
}

export interface SecretCacheEntry {
  readonly value: string;
  readonly resolvedAt: number;
  readonly expiresAt: number;
  readonly version?: string | undefined;
}

const DEFAULT_TTL_MS = 300_000;
const DEFAULT_MAX_ENTRIES = 1000;

export class SecretCache {
  private readonly cache = new Map<string, SecretCacheEntry>();
  private readonly defaultTtlMs: number;
  private readonly maxEntries: number;

  constructor(options: SecretCacheOptions = {}) {
    this.defaultTtlMs = options.defaultTtlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  get(key: string): SecretCacheEntry | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, value: string, version?: string, ttlMs?: number): void {
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value as string;
      this.cache.delete(firstKey);
    }
    const now = Date.now();
    this.cache.set(key, {
      value,
      resolvedAt: now,
      expiresAt: now + (ttlMs ?? this.defaultTtlMs),
      version,
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  entries(): ReadonlyMap<string, SecretCacheEntry> {
    return this.cache;
  }
}
