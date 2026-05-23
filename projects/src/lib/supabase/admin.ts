import { createClient } from "@supabase/supabase-js";
import { getRequiredServerSupabaseAdminEnv } from "@/lib/env/server";

export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } =
    getRequiredServerSupabaseAdminEnv();

  return createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false
    }
  });
}
