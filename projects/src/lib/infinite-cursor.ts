import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logInfo, logWarn } from "@/lib/observability";
import { getTraceId } from "@/lib/trace-context";

type OrderDirection = "asc" | "desc";
type CursorValue = string | number;

export interface CursorPage<T> {
  data: T[];
  nextCursor: CursorValue | null;
  hasMore: boolean;
  totalEstimate?: number;
  pageSize: number;
}

export interface CursorPaginatedQuery {
  table: string;
  select: string;
  cursorColumn: string;
  cursorDirection: OrderDirection;
  pageSize: number;
  cursor?: CursorValue | null;
  filters?: Record<string, unknown>;
  orderBy?: string;
  includeTotal?: boolean;
}

export async function queryCursorPage(q: CursorPaginatedQuery): Promise<CursorPage<Record<string, unknown>>> {
  const supabase = createAdminClient();
  const size = Math.min(Math.max(q.pageSize, 1), 1000);
  const cursorCol = q.cursorColumn;
  const dir = q.cursorDirection === "asc" ? "asc" : "desc";

  let query = supabase
    .from(q.table)
    .select(q.select, q.includeTotal ? { count: "estimated" } : undefined);

  if (q.filters) {
    for (const [key, value] of Object.entries(q.filters)) {
      query = query.eq(key, value);
    }
  }

  if (q.cursor && cursorCol) {
    if (dir === "asc") {
      query = query.gt(cursorCol, q.cursor);
    } else {
      query = query.lt(cursorCol, q.cursor);
    }
  }

  if (q.orderBy) {
    query = query.order(q.orderBy, { ascending: dir === "asc" });
  } else {
    query = query.order(cursorCol, { ascending: dir === "asc" });
  }

  query = query.limit(size + 1);

  const { data: rawData, count, error } = await query;
  const data = rawData as unknown as Record<string, unknown>[] | null;

  if (error) {
    logWarn("cursor.query_failed", {
      table: q.table,
      error: error.message,
      traceId: getTraceId(),
    });
    return { data: [], nextCursor: null, hasMore: false, pageSize: size };
  }

  if (!data || data.length === 0) {
    return { data: [], nextCursor: null, hasMore: false, pageSize: size, totalEstimate: count ?? undefined };
  }
  const hasMore = data.length > size;
  const rows = hasMore ? data.slice(0, size) : data;
  const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
  const nextCursor = hasMore && lastRow ? (lastRow[cursorCol] as CursorValue) : null;

  return {
    data: rows as Record<string, unknown>[],
    nextCursor,
    hasMore,
    pageSize: size,
    totalEstimate: count ?? undefined,
  };
}

export async function streamAllRows(
  query: Omit<CursorPaginatedQuery, "cursor" | "includeTotal">,
  batchSize = 500,
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  let cursor: CursorValue | null = null;

  for (let i = 0; i < 100_000; i++) {
    const page = await queryCursorPage({ ...query, cursor, pageSize: batchSize });
    results.push(...page.data);
    if (!page.hasMore || !page.nextCursor) break;
    cursor = page.nextCursor;
    logInfo("cursor.stream_progress", {
      table: query.table,
      fetched: results.length,
      cursor: String(cursor),
    });
  }

  return results;
}

export function encodeCursor(value: CursorValue): string {
  return Buffer.from(String(value)).toString("base64");
}

export function decodeCursor(encoded: string): CursorValue {
  const decoded = Buffer.from(encoded, "base64").toString("utf-8");
  const num = Number(decoded);
  return Number.isFinite(num) ? num : decoded;
}
