import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;
let nullClient: SupabaseClient | null = null;

function createNullSupabaseClient(): SupabaseClient {
  if (nullClient) return nullClient;

  class NullQueryBuilder {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_table: string) {}
    select(_columns?: string) { return this; }
    insert(_values: unknown) { return this; }
    update(_values: unknown) { return this; }
    delete() { return this; }
    eq(_col: string, _val: unknown) { return this; }
    neq(_col: string, _val: unknown) { return this; }
    gt(_col: string, _val: unknown) { return this; }
    gte(_col: string, _val: unknown) { return this; }
    lt(_col: string, _val: unknown) { return this; }
    lte(_col: string, _val: unknown) { return this; }
    like(_col: string, _val: unknown) { return this; }
    ilike(_col: string, _val: unknown) { return this; }
    is(_col: string, _val: unknown) { return this; }
    in(_col: string, _vals: unknown[]) { return this; }
    contains(_col: string, _val: unknown) { return this; }
    containedBy(_col: string, _val: unknown) { return this; }
    range(_col: string, _from: unknown, _to: unknown) { return this; }
    overlap(_col: string, _vals: unknown[]) { return this; }
    textSearch(_col: string, _query: string) { return this; }
    filter(_col: string, _op: string, _val: unknown) { return this; }
    not(_col: string, _op: string, _val: unknown) { return this; }
    or(_filters: string) { return this; }
    and(_filters: string) { return this; }
    order(_col: string, _opts?: unknown) { return this; }
    limit(_n: number) { return this; }
    offset(_n: number) { return this; }
    rangeStart(_n: number) { return this; }
    rangeEnd(_n: number) { return this; }
    single() { return Promise.resolve({ data: null, error: null, count: null }); }
    maybeSingle() { return Promise.resolve({ data: null, error: null }); }
    then(resolve: (val: { data: null; error: null; count?: null }) => void) {
      resolve({ data: null, error: null, count: null });
    }
    abortSignal(_signal: AbortSignal) { return this; }
    returns() { return this; }
  }

  nullClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key",
    { auth: { persistSession: false } }
  ) as unknown as SupabaseClient;

  (nullClient as any).from = (table: string) => new NullQueryBuilder(table);

  return nullClient;
}

export function createAdminClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!url || !key) {
    console.warn("[vrixo.supabase] SUPABASE_URL or SERVICE_ROLE_KEY missing — using null client (all queries return empty)");
    return createNullSupabaseClient();
  }

  try {
    const client = createClient(url, key, {
      auth: { persistSession: false },
    });
    cachedClient = client;
    return client;
  } catch (err) {
    console.error("[vrixo.supabase] Failed to create admin client:", err instanceof Error ? err.message : String(err));
    return createNullSupabaseClient();
  }
}

export function tryCreateAdminClient(): SupabaseClient {
  return createAdminClient();
}

export function resetAdminClient(): void {
  cachedClient = null;
  nullClient = null;
}
