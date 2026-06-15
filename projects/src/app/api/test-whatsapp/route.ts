import { NextResponse } from "next/server";
import { sendOrderConfirmationWhatsApp, hasWhatsAppServerEnv, getWhatsAppServerEnv } from "@/lib/whatsapp";

export async function GET() {
  try {
    const env = getWhatsAppServerEnv();
    const hasEnv = hasWhatsAppServerEnv();

    const diagnostics: Record<string, unknown> = {
      hasWhatsAppEnv: hasEnv,
      hasToken: Boolean(env.WHATSAPP_CLOUD_API_TOKEN),
      tokenLength: env.WHATSAPP_CLOUD_API_TOKEN?.length || 0,
      tokenPrefix: env.WHATSAPP_CLOUD_API_TOKEN?.slice(0, 10) || "none",
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || "missing",
      adminNumber: env.WHATSAPP_ADMIN_NUMBER || "missing",
      templateLanguage: env.WHATSAPP_TEMPLATE_LANGUAGE || "missing",
      graphApiVersion: env.WHATSAPP_GRAPH_API_VERSION || "missing",
    };

    if (!hasEnv) {
      return NextResponse.json({
        status: "ERROR",
        message: "WhatsApp env vars missing",
        diagnostics
      }, { status: 500 });
    }

    // Try sending a test message to admin
    const testPhone = env.WHATSAPP_ADMIN_NUMBER || "919023345354";
    const result = await sendOrderConfirmationWhatsApp({
      customerName: "Test Customer",
      customerPhone: testPhone,
      orderNumber: "TEST-001",
      productNames: "CK Watch",
      totalQty: 1,
      totalAmount: 2999,
      orderStatus: "pending",
      paymentMethod: "cod",
      paymentStatus: "cod_pending",
      productImageUrl: "https://vrixo.in/brand/vrixo-logo.svg",
      deliveryAddress: "Test Address, Mumbai, India",
    });

    return NextResponse.json({
      status: result.sent ? "SUCCESS" : "FAILED",
      message: result.sent ? "WhatsApp sent!" : `Failed: ${result.error}`,
      result,
      diagnostics
    });
  } catch (error: any) {
    return NextResponse.json({
      status: "ERROR",
      message: error?.message || "Unknown error",
      stack: error?.stack
    }, { status: 500 });
  }
}
