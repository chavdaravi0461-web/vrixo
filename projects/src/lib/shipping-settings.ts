import "server-only";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_CHARGE } from "@/lib/constants";
import { hasServerSupabaseAdminEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ShippingSettings } from "@/lib/order-pricing";

const METADATA_KEY = "vrixo_shipping_settings";

export const defaultShippingSettings: ShippingSettings = {
  mode: "free",
  shippingCharge: SHIPPING_CHARGE,
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD
};

export async function getShippingSettings(): Promise<ShippingSettings> {
  if (!hasServerSupabaseAdminEnv()) {
    return defaultShippingSettings;
  }

  try {
    const supabase = createAdminClient();
    const adminUserId = await getPrimaryAdminUserId();
    if (!adminUserId) return defaultShippingSettings;

    const { data, error } = await supabase.auth.admin.getUserById(adminUserId);
    if (error || !data.user) return defaultShippingSettings;

    return normalizeShippingSettings(data.user.app_metadata?.[METADATA_KEY]);
  } catch {
    return defaultShippingSettings;
  }
}

export async function saveShippingSettings(input: ShippingSettings) {
  const adminUserId = await getPrimaryAdminUserId();

  if (!adminUserId) {
    throw new Error("No active admin profile was found for storing shipping settings.");
  }

  const supabase = createAdminClient();
  const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(adminUserId);

  if (userError || !userResult.user) {
    throw new Error(userError?.message ?? "Admin user was not found.");
  }

  const settings = normalizeShippingSettings(input);
  const { error } = await supabase.auth.admin.updateUserById(adminUserId, {
    app_metadata: {
      ...userResult.user.app_metadata,
      [METADATA_KEY]: settings
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  return settings;
}

async function getPrimaryAdminUserId() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

function normalizeShippingSettings(value: unknown): ShippingSettings {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const shippingCharge = Math.max(
    0,
    Math.trunc(Number(source.shippingCharge ?? defaultShippingSettings.shippingCharge))
  );
  const freeShippingThreshold = Math.max(
    0,
    Math.trunc(Number(source.freeShippingThreshold ?? defaultShippingSettings.freeShippingThreshold))
  );

  return {
    mode: source.mode === "paid" ? "paid" : "free",
    shippingCharge,
    freeShippingThreshold
  };
}
