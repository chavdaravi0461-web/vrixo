import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/require-admin";
import { getShippingSettings, saveShippingSettings } from "@/lib/shipping-settings";
import { logAdminAudit } from "@/lib/admin-audit";
import { requireSameOrigin } from "@/lib/server/origin-check";
import { serverError } from "@/lib/api-response";
import { safeRoute } from "@/lib/safe-route";

const shippingSettingsSchema = z.object({
  mode: z.enum(["free", "paid"]),
  shippingCharge: z.coerce.number().finite().min(0).max(10000),
  freeShippingThreshold: z.coerce.number().finite().min(0).max(1000000)
});

export const GET = safeRoute(async function GET(request: Request) {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  return NextResponse.json({ settings: await getShippingSettings() });
});

export const PATCH = safeRoute(async function PATCH(request: Request) {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  const parsed = shippingSettingsSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid shipping settings." },
      { status: 400 }
    );
  }

  try {
    const settings = await saveShippingSettings({
      mode: parsed.data.mode,
      shippingCharge: Math.trunc(parsed.data.shippingCharge),
      freeShippingThreshold: Math.trunc(parsed.data.freeShippingThreshold)
    });

    await logAdminAudit({
      request,
      adminUserId: guard.admin.user.id,
      adminEmail: guard.admin.user.email,
      action: "shipping_settings.update",
      metadata: settings
    });

    return NextResponse.json({ message: "Shipping settings updated.", settings });
  } catch {
    return serverError("Shipping settings could not be saved.");
  }
});
