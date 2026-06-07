import "server-only";

interface RateLimitEntry {
  count: number;
  resetAt: number;
  blockedUntil: number;
  lastAccessAt: number;
  key: string;
}

interface AdaptiveRateLimitConfig {
  maxEntries: number;
  defaultLimit: number;
  defaultWindowMs: number;
  evictionThreshold: number;
  adaptiveSensitivity: number;
}

const DEFAULT_CONFIG: AdaptiveRateLimitConfig = {
  maxEntries: 100_000,
  defaultLimit: 60,
  defaultWindowMs: 60_000,
  evictionThreshold: 0.8,
  adaptiveSensitivity: 0.5,
};

class AdaptiveRateLimiter {
  private entries = new Map<string, RateLimitEntry>();
  private config: AdaptiveRateLimitConfig;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private lastAdaptiveAdjustment = 0;

  constructor(config?: Partial<AdaptiveRateLimitConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startEvictionCycle();
  }

  private startEvictionCycle(): void {
    setInterval(() => {
      this.evictStaleEntries();
    }, 60_000);
  }

  private evictStaleEntries(): void {
    const now = Date.now();
    const maxBeforeEviction = Math.floor(this.config.maxEntries * this.config.evictionThreshold);
    let evicted = 0;

    if (this.entries.size <= maxBeforeEviction) return;

    const sorted = Array.from(this.entries.entries())
      .sort(([, a], [, b]) => a.lastAccessAt - b.lastAccessAt);

    const toRemove = this.entries.size - maxBeforeEviction;
    for (let i = 0; i < toRemove && i < sorted.length; i++) {
      const [key] = sorted[i];
      this.entries.delete(key);
      evicted++;
    }

    this.evictions += evicted;
  }

  async check(key: string, limit?: number, windowMs?: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfter: number;
  }> {
    const now = Date.now();
    const effectiveLimit = limit ?? this.config.defaultLimit;
    const effectiveWindow = windowMs ?? this.config.defaultWindowMs;

    if (this.entries.size >= this.config.maxEntries) {
      this.evictStaleEntries();
    }

    const existing = this.entries.get(key);
    const resetAt = now + effectiveWindow;

    if (!existing || existing.resetAt <= now) {
      this.entries.set(key, {
        count: 1,
        resetAt,
        blockedUntil: 0,
        lastAccessAt: now,
        key,
      });
      this.misses++;
      return { allowed: true, remaining: effectiveLimit - 1, resetAt, retryAfter: 0 };
    }

    if (existing.blockedUntil > now) {
      this.hits++;
      existing.lastAccessAt = now;
      return {
        allowed: false,
        remaining: 0,
        resetAt: existing.resetAt,
        retryAfter: Math.ceil((existing.blockedUntil - now) / 1000),
      };
    }

    existing.count++;
    existing.lastAccessAt = now;
    this.hits++;

    if (existing.count > effectiveLimit) {
      existing.blockedUntil = now + Math.min(effectiveWindow, 300_000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: existing.resetAt,
        retryAfter: Math.ceil(effectiveWindow / 1000),
      };
    }

    return { allowed: true, remaining: effectiveLimit - existing.count, resetAt, retryAfter: 0 };
  }

  getStats() {
    return {
      entries: this.entries.size,
      maxEntries: this.config.maxEntries,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      utilization: this.entries.size / this.config.maxEntries,
    };
  }

  clear(): void {
    this.entries.clear();
  }

  resetKey(key: string): void {
    this.entries.delete(key);
  }
}

export const adaptiveRateLimiter = new AdaptiveRateLimiter();
