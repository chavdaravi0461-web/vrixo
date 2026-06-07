import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route";
import { hasServerSupabaseAdminEnv } from "@/lib/env/server";
import { getIndianMobileLookupVariants, normalizeIndianMobileNumber } from "@/lib/phone";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/api-response";
import { sanitizeRedirectPath } from "@/lib/safe-navigation";
import { safeRoute } from "@/lib/safe-route";

const passwordLoginSchema = z.object({
  identifier: z.string().trim().min(3),
  password: z.string().min(6),
  next: z.string().trim().max(500).optional()
});

export const POST = safeRoute(async function POST(request: NextRequest) {
  const rateLimit = await checkServerRateLimit(request, { key: "login", limit: 8, windowMs: 60 * 1000 });
  if (!rateLimit.allowed) return tooManyRequests(rateLimit.retryAfter);

  const parsed = passwordLoginSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid login request." },
      { status: 400 }
    );
  }

  const identifier = parsed.data.identifier.trim();
  const email = identifier.includes("@") ? identifier.toLowerCase() : await findEmailForMobile(identifier);

  if (!email) {
    return NextResponse.json(
      { message: "Email/mobile number or password is incorrect." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({
    redirectTo: sanitizeRedirectPath(parsed.data.next)
  });
  const supabase = createRouteHandlerSupabaseClient(request, response);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password
  });

  if (error || !data.session || !data.user) {
    return NextResponse.json(
      { message: "Unable to login. Please check your details or verify your email." },
      { status: 401 }
    );
  }

  return response;
});

async function findEmailForMobile(value: string) {
  const normalizedPhone = normalizeIndianMobileNumber(value);

  if (!normalizedPhone) {
    return null;
  }

  if (!hasServerSupabaseAdminEnv()) {
    return null;
  }

  const variants = getIndianMobileLookupVariants(normalizedPhone);
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("email")
      .in("phone", variants)
      .not("email", "is", null)
      .limit(1)
      .maybeSingle();

    if (error || !data?.email) {
      return null;
    }

    return data.email;
  } catch {
    return null;
  }
}
