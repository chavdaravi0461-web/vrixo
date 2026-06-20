import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasServerSupabaseAdminEnv } from "@/lib/env/server";
import { getIndianMobileLookupVariants, normalizeIndianMobileNumber } from "@/lib/phone";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route";
import { sanitizeRedirectPath } from "@/lib/safe-navigation";
import { safeRoute } from "@/lib/safe-route";
import { requireSameOrigin } from "@/lib/server/origin-check";
import { tooManyRequests } from "@/lib/api-response";
import { autoSubscribeToNewsletter } from "@/lib/newsletter/auto-subscribe";
// @ts-expect-error — firebase/users.js has no type declarations
import { createUser as createFirebaseUser } from "@/lib/firebase/users";

const passwordSignupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  phone: z.string().trim().min(10, "Enter a valid mobile number.").optional().default(""),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  next: z.string().trim().max(500).optional()
});

export const POST = safeRoute(async function POST(request: NextRequest) {
  const originCheck = requireSameOrigin(request);
  if (originCheck) return originCheck;
  const rateLimit = await checkServerRateLimit(request, { key: "signup", limit: 5, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) return tooManyRequests(rateLimit.retryAfter);

  const parsed = passwordSignupSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid signup request." },
      { status: 400 }
    );
  }

  if (!hasServerSupabaseAdminEnv()) {
    return NextResponse.json(
      { message: "Signup is not configured yet. Please contact support." },
      { status: 500 }
    );
  }

  const normalizedPhone = parsed.data.phone ? normalizeIndianMobileNumber(parsed.data.phone) : null;

  const adminSupabase = createAdminClient();

  if (normalizedPhone) {
    const duplicatePhone = await findExistingProfileByPhone(adminSupabase, normalizedPhone);
    if (duplicatePhone) {
      return NextResponse.json(
        { message: "An account with this mobile number already exists. Please login instead." },
        { status: 409 }
      );
    }
  }

  const { data: created, error: createError } = await adminSupabase.auth.admin.createUser({
    email: parsed.data.email,
    phone: normalizedPhone || undefined,
    password: parsed.data.password,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: {
      name: parsed.data.name,
      phone: normalizedPhone || ""
    }
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { message: getSignupErrorMessage(createError?.message) },
      { status: 400 }
    );
  }

  const { error: profileError } = await adminSupabase.from("profiles").upsert(
    {
      id: created.user.id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: normalizedPhone || "",
      role: "customer",
      is_active: true
    },
    { onConflict: "id" }
  );

  if (profileError) {
    await adminSupabase.auth.admin.deleteUser(created.user.id).catch(() => null);
    return NextResponse.json(
      { message: getSignupErrorMessage(profileError.message) },
      { status: 500 }
    );
  }

  // Also create Firebase user so NextAuth login works
  await createFirebaseUser({
    name: parsed.data.name,
    email: parsed.data.email,
    password: parsed.data.password,
    provider: "credentials",
  }).catch((err: any) => {
    console.error("[password-signup] firebase sync failed (non-fatal):", err?.message);
  });

  const response = NextResponse.json({
    redirectTo: sanitizeRedirectPath(parsed.data.next)
  });
  const routeSupabase = createRouteHandlerSupabaseClient(request, response);
  const { data: signInData, error: signInError } = await routeSupabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (signInError || !signInData.session || !signInData.user) {
    return NextResponse.json(
      { message: "Account was created, but login could not be started. Please login again." },
      { status: 500 }
    );
  }

  void autoSubscribeToNewsletter(parsed.data.email);

  return response;
});

function getSignupErrorMessage(message = "") {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("already") || lowerMessage.includes("registered")) {
    return "An account with this email already exists. Please login instead.";
  }

  return message || "Account could not be created. Please try again.";
}

async function findExistingProfileByPhone(
  supabase: ReturnType<typeof createAdminClient>,
  normalizedPhone: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .in("phone", getIndianMobileLookupVariants(normalizedPhone))
    .limit(1);

  if (error) {
    return null;
  }

  return data?.[0] ?? null;
}
