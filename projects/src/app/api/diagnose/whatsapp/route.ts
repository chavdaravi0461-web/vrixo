import { NextResponse } from "next/server";
import { formatWhatsAppPhone } from "@/lib/whatsapp/phone";
import { requireAdminApi } from "@/lib/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = await requireAdminApi(request);
  if (!authResult.ok) return authResult.response;

  const results: Record<string, unknown> = {};

  const envToken = process.env.WHATSAPP_CLOUD_API_TOKEN || "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";

  results.phoneInfo = { phoneNumberId };

  // 1. Get phone number info
  try {
    const phoneResp = await fetch(
      `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating,account_mode`,
      { headers: { Authorization: `Bearer ${envToken}` } }
    );
    const phoneData: Record<string, unknown> = await phoneResp.json();
    results.phoneInfo = phoneData;
  } catch (e: unknown) { results.phoneInfoError = String(e); }

  // 2. List templates
  try {
    const templatesResp = await fetch(
      `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/message_templates?fields=name,status,language,category,components&limit=50`,
      { headers: { Authorization: `Bearer ${envToken}` } }
    );
    const templatesData: Record<string, unknown> = await templatesResp.json();
    results.templatesFromPhone = templatesData;
  } catch (e: unknown) { results.templatesError = String(e); }

  // 3. Send text message (phone without + prefix)
  const digits = (process.env.WHATSAPP_ADMIN_NUMBER || "").replace(/\D/g, "");
  const phoneE164 = digits.length === 10 ? `91${digits}` : digits.startsWith("91") ? digits : digits.slice(-10);
  results.adminPhoneE164 = phoneE164;

  if (phoneE164.length >= 12) {
    try {
      const textResp = await fetch(
        `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${envToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phoneE164,
            type: "text",
            text: { body: "Vrixo WhatsApp diagnostic test - ignore this" }
          }),
        }
      );
      const textData: Record<string, unknown> = await textResp.json();
      results.textMessageTest = { status: textResp.status, ok: textResp.ok, response: textData };
    } catch (e: unknown) { results.textMessageError = String(e); }
  }

  return NextResponse.json(results, { status: 200 });
}
