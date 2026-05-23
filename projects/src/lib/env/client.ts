import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().optional().default("https://www.vrixo.in"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional().default(""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().default(""),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional().default("")
});

const requiredClientSupabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase project URL."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required for the browser Supabase client.")
});

export function getClientEnv() {
  return parseClientEnv(
    clientEnvSchema,
    {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    },
    "Client environment variables are invalid."
  );
}

export function getRequiredClientSupabaseEnv() {
  return parseClientEnv(
    requiredClientSupabaseSchema,
    {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    },
    "Supabase browser configuration is incomplete."
  );
}

export function hasClientSupabaseEnv() {
  const env = getClientEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function hasRazorpayClientEnv() {
  const env = getClientEnv();
  return Boolean(env.NEXT_PUBLIC_RAZORPAY_KEY_ID);
}

function parseClientEnv<T extends z.ZodTypeAny>(
  schema: T,
  values: unknown,
  contextMessage: string
) {
  const parsed = schema.safeParse(values);

  if (parsed.success) {
    return parsed.data;
  }

  const details = parsed.error.issues.map((issue) => issue.message).join(" ");
  throw new Error(`${contextMessage} ${details}`.trim());
}
