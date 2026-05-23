"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getRequiredClientSupabaseEnv } from "@/lib/env/client";

export function createBrowserSupabaseClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } =
    getRequiredClientSupabaseEnv();

  return createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
