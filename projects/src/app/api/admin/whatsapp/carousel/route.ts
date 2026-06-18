import { NextResponse } from "next/server";
import { getWhatsAppServerEnv, formatWhatsAppPhone, sendWhatsAppProductCarousel } from "@/lib/whatsapp";
import { requireAnyHeaderSecret } from "@/lib/server/secret-guard";
import { safeRoute } from "@/lib/safe-route";

export const POST = safeRoute(async function POST(request: Request) {
  const authError = requireAnyHeaderSecret(request, ["x-admin-key"], [process.env.ADMIN_API_KEY]);
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const to = String(body.to ?? "");
  const products = Array.isArray(body.products) ? body.products : [];
  const caption = String(body.caption ?? "");

  if (!to || products.length === 0) return NextResponse.json({ message: "to and products required" }, { status: 400 });

  const env = getWhatsAppServerEnv();
  const phone = formatWhatsAppPhone(to);
  if (!phone) return NextResponse.json({ message: "invalid phone" }, { status: 400 });

  try {
    await sendWhatsAppProductCarousel({ to: phone, products, token: env.WHATSAPP_CLOUD_API_TOKEN, phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID, caption });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ message: "failed" }, { status: 500 });
  }
});
