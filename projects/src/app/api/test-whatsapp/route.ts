import { NextResponse } from "next/server";
import { sendOrderConfirmationWhatsApp, hasWhatsAppServerEnv } from "@/lib/whatsapp";
import { requireAdminApi } from "@/lib/require-admin";

export async function GET(request: Request) {
  try {
    const authResult = await requireAdminApi(request);
    if (!authResult.ok) return authResult.response;

    const hasEnv = hasWhatsAppServerEnv();

    if (!hasEnv) {
      return NextResponse.json({
        status: "ERROR",
        message: "WhatsApp env vars missing"
      }, { status: 500 });
    }

    const env = {
      WHATSAPP_ADMIN_NUMBER: process.env.WHATSAPP_ADMIN_NUMBER || "",
      WHATSAPP_TEMPLATE_LANGUAGE: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en"
    };

    const testPhone = env.WHATSAPP_ADMIN_NUMBER;
    if (!testPhone) {
      return NextResponse.json({
        status: "ERROR",
        message: "Admin phone number not configured"
      }, { status: 500 });
    }

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
      message: result.sent ? "WhatsApp sent!" : "Failed to send"
    });
  } catch {
    return NextResponse.json({
      status: "ERROR",
      message: "Something went wrong"
    }, { status: 500 });
  }
}
