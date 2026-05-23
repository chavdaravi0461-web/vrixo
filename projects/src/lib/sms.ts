import Twilio from "twilio";
import { getOptionalServerEnv } from "@/lib/env/server";

type SmsPayload = {
  customerName: string;
  phone: string;
  orderNumber: string;
  productNames: string;
  totalQty: number;
  totalAmount: number;
  orderStatus: string;
};

export function buildOrderSmsMessage(payload: SmsPayload) {
  return `Vrixo: Hi ${payload.customerName}, your order ${payload.orderNumber} is confirmed. Products: ${payload.productNames}. Qty: ${payload.totalQty}. Amount: Rs.${payload.totalAmount}. Status: ${payload.orderStatus}. Thank you for shopping with us.`;
}

export async function sendOrderConfirmationSms(payload: SmsPayload) {
  const serverEnv = getOptionalServerEnv();
  const provider = serverEnv.SMS_PROVIDER || "twilio";

  if (provider !== "twilio") {
    return {
      sent: false,
      provider,
      error: "Unsupported SMS provider. Configure SMS_PROVIDER=twilio."
    };
  }

  const accountSid = serverEnv.TWILIO_ACCOUNT_SID;
  const authToken = serverEnv.TWILIO_AUTH_TOKEN;
  const from = serverEnv.TWILIO_SMS_FROM;

  if (!accountSid || !authToken || !from) {
    return {
      sent: false,
      provider,
      error: "Twilio credentials are missing. SMS skipped."
    };
  }

  const client = Twilio(accountSid, authToken);
  const message = buildOrderSmsMessage(payload);

  await client.messages.create({
    body: message,
    from,
    to: payload.phone
  });

  return {
    sent: true,
    provider,
    error: null
  };
}
