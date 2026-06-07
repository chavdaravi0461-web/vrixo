/**
 * Request coalescing — deduplicates concurrent identical in-flight requests.
 *
 * When N identical requests arrive simultaneously (e.g., cache stampede,
 * webhook duplicate, double-click), only ONE actually executes.
 * The rest wait for and share the same result.
 *
 * Usage:
 *   const result = await coalesce("order:123", () => fetchOrder("123"));
 */

const inFlight = new Map<string, Promise<unknown>>();
const MAX_COALESCED_KEYS = 1000;
const COALESCED_TTL_MS = 30_000;

// Track when each key was last resolved to prevent unbounded Map growth
const resolvedAt = new Map<string, number>();

function cleanup(): void {
  const now = Date.now();
  for (const [key, ts] of resolvedAt) {
    if (now - ts > COALESCED_TTL_MS) {
      inFlight.delete(key);
      resolvedAt.delete(key);
    }
  }
  if (inFlight.size > MAX_COALESCED_KEYS) {
    const keysToDelete = inFlight.size - MAX_COALESCED_KEYS;
    const iter = inFlight.keys();
    for (let i = 0; i < keysToDelete; i++) {
      const key = iter.next().value;
      if (key) {
        inFlight.delete(key);
        resolvedAt.delete(key);
      }
    }
  }
}

export async function coalesce<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fetcher()
    .then((result) => {
      resolvedAt.set(key, Date.now());
      return result;
    })
    .catch((err) => {
      inFlight.delete(key);
      resolvedAt.delete(key);
      throw err;
    });

  inFlight.set(key, promise);
  cleanup();

  try {
    return await promise;
  } finally {
    // Keep resolved promises in map briefly for late-arriving coalesced callers
    setTimeout(() => {
      // Only remove if this exact promise is still there (not replaced)
      if (inFlight.get(key) === promise) {
        inFlight.delete(key);
        resolvedAt.delete(key);
      }
    }, 1_000);
  }
}

export function getCoalescedKeysCount(): number {
  return inFlight.size;
}

export function clearCoalescedCache(): void {
  inFlight.clear();
  resolvedAt.clear();
}
