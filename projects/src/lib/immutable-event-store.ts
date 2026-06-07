import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRedis } from "@/lib/redis";
import { logInfo, logWarn, logError } from "@/lib/observability";
import { getTraceId } from "@/lib/trace-context";

interface StoredEvent {
  id: string;
  stream: string;
  streamId: string;
  type: string;
  version: number;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  previousHash: string;
  hash: string;
  createdAt: string;
  traceId: string;
}

const STREAM_CACHE_PREFIX = "eventstore:stream:";
const STREAM_CACHE_TTL = 3600;

async function computeHash(event: Omit<StoredEvent, "hash">): Promise<string> {
  const content = `${event.stream}:${event.streamId}:${event.version}:${event.type}:${JSON.stringify(event.data)}:${JSON.stringify(event.metadata)}:${event.previousHash}:${event.createdAt}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function appendEvent(
  stream: string,
  streamId: string,
  type: string,
  data: Record<string, unknown>,
  metadata: Record<string, unknown> = {},
): Promise<StoredEvent> {
  const supabase = createAdminClient();
  const traceId = getTraceId();
  const createdAt = new Date().toISOString();

  const previousHash = await getStreamLatestHash(stream, streamId);
  const version = await getStreamNextVersion(stream, streamId);

  const eventBase: Omit<StoredEvent, "hash"> = {
    id: crypto.randomUUID(),
    stream,
    streamId,
    type,
    version,
    data,
    metadata: { ...metadata, traceId },
    previousHash,
    createdAt,
    traceId,
  };

  const hash = await computeHash(eventBase);
  const event: StoredEvent = { ...eventBase, hash };

  const { error } = await supabase.from("app_events").insert({
    id: event.id,
    type: `eventstore.${stream}.${type}`,
    severity: "info",
    entity_id: streamId,
    entity_type: stream,
    payload: {
      eventstore: true,
      stream,
      streamId,
      version,
      hash,
      previousHash,
      data,
      metadata: event.metadata,
      traceId,
    },
    created_at: createdAt,
  });

  if (error) {
    logError("eventstore.append_failed", { stream, streamId, type, error: error.message });
    throw new Error(`EventStore append failed: ${error.message}`);
  }

  await withRedis(async (redis) => {
    const cacheKey = `${STREAM_CACHE_PREFIX}${stream}:${streamId}`;
    await redis.hset(cacheKey, { latestHash: hash, version: version, lastEventId: event.id });
    await redis.expire(cacheKey, STREAM_CACHE_TTL);
    await redis.lpush(`eventstore:events:${stream}:${streamId}`, JSON.stringify(event));
    await redis.ltrim(`eventstore:events:${stream}:${streamId}`, 0, 999);
    return true;
  }, false);

  logInfo("eventstore.appended", { stream, streamId, type, version, hash: hash.slice(0, 12) });
  return event;
}

export async function getStreamEvents(
  stream: string,
  streamId: string,
  fromVersion?: number,
  limit = 100,
): Promise<StoredEvent[]> {
  const cached = await withRedis(async (redis) => {
    const raw = await redis.lrange(`eventstore:events:${stream}:${streamId}`, 0, limit - 1);
    return raw.map((r) => JSON.parse(r) as StoredEvent);
  }, [] as StoredEvent[]);

  if (cached.length > 0) {
    if (fromVersion !== undefined) {
      return cached.filter((e) => e.version >= fromVersion).slice(0, limit);
    }
    return cached;
  }

  try {
    const supabase = createAdminClient();
    const { data: rows, error } = await supabase
      .from("app_events")
      .select("id, type, entity_id, entity_type, payload, created_at")
      .eq("entity_type", stream)
      .eq("entity_id", streamId)
      .like("type", "eventstore.%")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error || !rows) return [];

    return rows
      .filter((r) => r.payload && typeof r.payload === "object" && "eventstore" in (r.payload as Record<string, unknown>))
      .map((r) => {
        const p = r.payload as Record<string, unknown>;
        return {
          id: r.id,
          stream: String(p.stream ?? stream),
          streamId: String(p.streamId ?? streamId),
          type: String(p.type ?? r.type),
          version: Number(p.version ?? 0),
          data: (p.data ?? {}) as Record<string, unknown>,
          metadata: (p.metadata ?? {}) as Record<string, unknown>,
          previousHash: String(p.previousHash ?? ""),
          hash: String(p.hash ?? ""),
          createdAt: r.created_at,
          traceId: String((p.metadata as Record<string, unknown>)?.traceId ?? ""),
        } as StoredEvent;
      });
  } catch {
    return [];
  }
}

export async function verifyStreamIntegrity(stream: string, streamId: string): Promise<{
  valid: boolean;
  eventCount: number;
  brokenAt?: number;
  errors: string[];
}> {
  const events = await getStreamEvents(stream, streamId, undefined, 1000);
  const errors: string[] = [];
  let previousHash = "";
  let brokenAt: number | undefined;

  for (const event of events) {
    const expectedHash = await computeHash({
      id: event.id,
      stream: event.stream,
      streamId: event.streamId,
      type: event.type,
      version: event.version,
      data: event.data,
      metadata: event.metadata,
      previousHash: event.previousHash,
      createdAt: event.createdAt,
      traceId: event.traceId,
    });

    if (event.hash !== expectedHash) {
      errors.push(`Hash mismatch at version ${event.version}: expected ${expectedHash.slice(0, 12)}, got ${event.hash.slice(0, 12)}`);
      if (brokenAt === undefined) brokenAt = event.version;
    }

    if (event.previousHash !== previousHash) {
      errors.push(`Chain break at version ${event.version}: expected prev ${previousHash.slice(0, 12)}, got ${event.previousHash.slice(0, 12)}`);
      if (brokenAt === undefined) brokenAt = event.version;
    }

    previousHash = event.hash;
  }

  return {
    valid: errors.length === 0,
    eventCount: events.length,
    brokenAt,
    errors,
  };
}

async function getStreamLatestHash(stream: string, streamId: string): Promise<string> {
  return withRedis(async (redis) => {
    const cacheKey = `${STREAM_CACHE_PREFIX}${stream}:${streamId}`;
    const hash = await redis.hget(cacheKey, "latestHash");
    return hash ?? "";
  }, "");
}

async function getStreamNextVersion(stream: string, streamId: string): Promise<number> {
  const cached = await withRedis(async (redis) => {
    const cacheKey = `${STREAM_CACHE_PREFIX}${stream}:${streamId}`;
    const ver = await redis.hget(cacheKey, "version");
    return ver ? Number(ver) + 1 : null;
  }, null as number | null);

  if (cached !== null) return cached;

  const events = await getStreamEvents(stream, streamId, undefined, 1);
  return events.length > 0 ? events[events.length - 1].version + 1 : 1;
}
