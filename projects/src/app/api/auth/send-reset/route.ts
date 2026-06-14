import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { sendEmail, hasEmailEnv } from "@/lib/email";
import { buildPasswordResetEmailHtml, buildPasswordResetWhatsAppMessage } from "@/lib/email-templates/password-reset";
import { sendWhatsAppTextMessage, hasWhatsAppServerEnv, getWhatsAppServerEnv, formatWhatsAppPhone } from "@/lib/whatsapp";
import { logInfo, logError } from "@/lib/observability";

const schema = z.object({
  email: z.string().email(),
  channel: z.enum(["email", "whatsapp"]),
  userId: z.string().uuid(),
  name: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkServerRateLimit(request, { key: "send-reset", limit: 3, windowMs: 10 * 60 * 1000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ message: "Too many requests. Try again later." }, { status: 429 });
    }

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }

    const { email, channel, userId, name } = parsed.data;
    const supabase = createAdminClient();
    const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
    const siteUrl = rawSiteUrl.includes("localhost") ? "https://vrixo.in" : (rawSiteUrl || "https://vrixo.in");

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: `${siteUrl}/reset-password`
      }
    });

    if (linkError || !linkData?.properties?.action_link) {
      logError("send-reset.link_error", { error: linkError?.message || "no_action_link" });
      return NextResponse.json({ message: "Failed to generate reset link. Please try again." }, { status: 500 });
    }

    // Supabase uses project's Site URL for redirect_to — override localhost with production URL
    const actionLink = linkData.properties.action_link;
    const resetUrl = actionLink
      .replace(/redirect_to=http:\/\/localhost:\d+/, `redirect_to=${encodeURIComponent(siteUrl + "/reset-password")}`)
      .replace(/redirect_to=http:\/\/127\.0\.0\.1:\d+/, `redirect_to=${encodeURIComponent(siteUrl + "/reset-password")}`);

    if (channel === "email") {
      if (!hasEmailEnv()) {
        return NextResponse.json({ message: "Email service not configured." }, { status: 500 });
      }

      const html = buildPasswordResetEmailHtml({ resetUrl, customerName: name });
      const result = await sendEmail({
        to: email,
        subject: "Reset your Vrixo password",
        html
      });

      if (!result.sent) {
        logError("send-reset.email_failed", { error: result.error || undefined });
        return NextResponse.json({ message: "Failed to send email. Please try again." }, { status: 500 });
      }

      logInfo("send-reset.email_sent", { userId, email: email.slice(0, 3) + "***" });
      return NextResponse.json({ message: "Password reset link sent to your email." });

    } else if (channel === "whatsapp") {
      if (!hasWhatsAppServerEnv()) {
        return NextResponse.json({ message: "WhatsApp service not configured." }, { status: 500 });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", userId)
        .single();

      if (!profile?.phone) {
        return NextResponse.json({ message: "Phone number not found." }, { status: 404 });
      }

      const whatsappEnv = getWhatsAppServerEnv();
      const textMessage = buildPasswordResetWhatsAppMessage({ resetUrl, customerName: name });
      const formattedPhone = formatWhatsAppPhone(profile.phone);

      try {
        await sendWhatsAppTextMessage({
          to: formattedPhone,
          text: textMessage,
          token: whatsappEnv.WHATSAPP_CLOUD_API_TOKEN,
          phoneNumberId: whatsappEnv.WHATSAPP_PHONE_NUMBER_ID
        });
      } catch (waErr) {
        logError("send-reset.whatsapp_failed", { error: waErr instanceof Error ? waErr.message : String(waErr) });
        return NextResponse.json({ message: "Failed to send WhatsApp message. Please try email instead." }, { status: 500 });
      }

      logInfo("send-reset.whatsapp_sent", { userId, phone: profile.phone.slice(-4) });
      return NextResponse.json({ message: "Password reset link sent to your WhatsApp." });
    }

    return NextResponse.json({ message: "Invalid channel." }, { status: 400 });
  } catch (err) {
    logError("send-reset.unhandled", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
