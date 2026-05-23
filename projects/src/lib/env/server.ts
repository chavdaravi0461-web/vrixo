import "server-only";
import { z } from "zod";

const requiredServerSupabaseAdminSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase project URL."),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required for server-side Supabase operations.")
});

const optionalServerSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional().default(""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().default(""),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
  TWILIO_ACCOUNT_SID: z.string().optional().default(""),
  TWILIO_AUTH_TOKEN: z.string().optional().default(""),
  TWILIO_SMS_FROM: z.string().optional().default(""),
  SMS_PROVIDER: z.string().optional().default("twilio"),
  OTP_AUTH_SECRET: z.string().optional().default(""),
  WHATSAPP_CLOUD_API_TOKEN: z.string().optional().default(""),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(""),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(""),
  WHATSAPP_ADMIN_NUMBER: z.string().optional().default(""),
  WHATSAPP_VERIFY_TOKEN: z.string().optional().default(""),
  WHATSAPP_WEBHOOK_SECRET: z.string().optional().default(""),
  NOTIFICATION_WORKER_SECRET: z.string().optional().default(""),
  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),
  CHECKOUT_TOKEN_SECRET: z.string().optional().default(""),
  ADMIN_ACCESS_CODE: z.string().optional().default(""),
  ADMIN_SESSION_SECRET: z.string().optional().default("")
});

export function getOptionalServerEnv() {
  return parseServerEnv(optionalServerSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_SMS_FROM: process.env.TWILIO_SMS_FROM,
    SMS_PROVIDER: process.env.SMS_PROVIDER,
    OTP_AUTH_SECRET: process.env.OTP_AUTH_SECRET,
    WHATSAPP_CLOUD_API_TOKEN:
      process.env.WHATSAPP_CLOUD_API_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_ADMIN_NUMBER: process.env.WHATSAPP_ADMIN_NUMBER,
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
    WHATSAPP_WEBHOOK_SECRET: process.env.WHATSAPP_WEBHOOK_SECRET,
    NOTIFICATION_WORKER_SECRET: process.env.NOTIFICATION_WORKER_SECRET,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
    CHECKOUT_TOKEN_SECRET: process.env.CHECKOUT_TOKEN_SECRET,
    ADMIN_ACCESS_CODE: process.env.ADMIN_ACCESS_CODE,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET
  });
}

export function getRequiredServerSupabaseAdminEnv() {
  return parseServerEnv(
    requiredServerSupabaseAdminSchema,
    {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
    },
    "Supabase server configuration is incomplete."
  );
}

export function hasServerSupabaseAdminEnv() {
  const env = getOptionalServerEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasTwilioEnv() {
  const env = getOptionalServerEnv();
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_SMS_FROM);
}

export function hasRazorpayServerEnv() {
  const env = getOptionalServerEnv();
  const keyId = env.RAZORPAY_KEY_ID || env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

  return Boolean(
    env.NEXT_PUBLIC_RAZORPAY_KEY_ID &&
      keyId &&
      env.RAZORPAY_KEY_SECRET
  );
}

const requiredRazorpayServerSchema = z.object({
  RAZORPAY_PUBLIC_KEY_ID: z
    .string()
    .min(1, "NEXT_PUBLIC_RAZORPAY_KEY_ID is required for Razorpay checkout."),
  RAZORPAY_KEY_ID: z
    .string()
    .min(1, "RAZORPAY_KEY_ID is required for Razorpay server checkout."),
  RAZORPAY_KEY_SECRET: z
    .string()
    .min(1, "RAZORPAY_KEY_SECRET is required for Razorpay server verification.")
});

export function getRequiredRazorpayServerEnv() {
  return parseServerEnv(
    requiredRazorpayServerSchema,
    {
      RAZORPAY_PUBLIC_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET
    },
    "Razorpay server configuration is incomplete."
  );
}

function parseServerEnv<T extends z.ZodTypeAny>(
  schema: T,
  values: unknown,
  contextMessage = "Server environment variables are invalid."
) {
  const parsed = schema.safeParse(values);

  if (parsed.success) {
    return parsed.data;
  }

  const details = parsed.error.issues.map((issue) => issue.message).join(" ");
  throw new Error(`${contextMessage} ${details}`.trim());
}
