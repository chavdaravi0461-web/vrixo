import { hasServerSupabaseAdminEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function autoSubscribeToNewsletter(email: string): Promise<void> {
  try {
    if (!hasServerSupabaseAdminEnv()) return;

    const normalized = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) return;

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("newsletter_subscriptions")
      .upsert({ email: normalized }, { onConflict: "email" });

    if (error) {
      console.warn("[newsletter.auto] upsert_failed", JSON.stringify({ email: normalized, error: error.message }));
    }
  } catch (err) {
    console.warn("[newsletter.auto] unexpected_error", JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
  }
}
