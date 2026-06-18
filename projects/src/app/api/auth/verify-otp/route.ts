import { z } from "zod";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route";
import { ensureOtpCustomerUser, findProfileByPhone } from "@/lib/phone-auth-server";
import { normalizeIndianMobileNumber } from "@/lib/phone";
import { hasOtpAuthSecret, isOtpCodeValid } from "@/lib/otp-auth";
import { hasServerSupabaseAdminEnv } from "@/lib/env/server";
import { isSupabaseConfigured } from "@/lib/utils";
import { serverError } from "@/lib/api-response";
import { safeRoute } from "@/lib/safe-route";

import { sanitizeRedirectPath } from "@/lib/safe-navigation";

const verifyOtpSchema = z.object({
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().min(1, "Mobile number is required."),
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit OTP."),
  mode: z.enum(["login", "signup"]).default("signup"),
  next: z.string().trim().max(500).optional()
});

export const POST = safeRoute(async function POST(request: NextRequest) {
  if (!isSupabaseConfigured() || !hasServerSupabaseAdminEnv()) {
    return serverError("OTP authentication is temporarily unavailable.");
  }

  if (!hasOtpAuthSecret()) {
    return serverError("OTP authentication is temporarily unavailable.");
  }

  const parsed = verifyOtpSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.issues[0]?.message ?? "Invalid OTP verification request."
      },
      { status: 400 }
    );
  }

  const normalizedPhone = normalizeIndianMobileNumber(parsed.data.phone);

  if (!normalizedPhone) {
    return NextResponse.json(
      {
        message: "Enter a valid Indian mobile number."
      },
      { status: 400 }
    );
  }

  const response = NextResponse.json({
    success: true,
    redirectTo: sanitizeRedirectPath(parsed.data.next, "/account")
  });

  const routeSupabase = createRouteHandlerSupabaseClient(request, response);
  const adminSupabase = createAdminClient();
  const { data: otpRequest, error: otpError } = await adminSupabase
    .from("phone_otp_requests")
    .select("phone, name, otp_hash, expires_at, attempts_left")
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (otpError) {
    return NextResponse.json(
      {
        message: "OTP verification could not be completed. Please try again."
      },
      { status: 500 }
    );
  }

  if (!otpRequest) {
    return NextResponse.json(
      {
        message: "No active OTP was found for this mobile number. Please request a new OTP."
      },
      { status: 400 }
    );
  }

  if (new Date(otpRequest.expires_at).getTime() <= Date.now()) {
    await adminSupabase.from("phone_otp_requests").delete().eq("phone", normalizedPhone);

    return NextResponse.json(
      {
        message: "OTP expired. Please request a new one."
      },
      { status: 400 }
    );
  }

  const otpMatches = isOtpCodeValid({
    phone: normalizedPhone,
    code: parsed.data.otp,
    hash: otpRequest.otp_hash
  });

  if (!otpMatches) {
    const attemptsLeft = Math.max(otpRequest.attempts_left - 1, 0);

    if (attemptsLeft === 0) {
      await adminSupabase.from("phone_otp_requests").delete().eq("phone", normalizedPhone);

      return NextResponse.json(
        {
          message: `Maximum OTP attempts reached. Please request a new OTP.`
        },
        { status: 400 }
      );
    }

    await adminSupabase
      .from("phone_otp_requests")
      .update({
        attempts_left: attemptsLeft
      })
      .eq("phone", normalizedPhone);

    return NextResponse.json(
      {
        message:
          attemptsLeft === 1
            ? "Incorrect OTP. You have 1 attempt left."
            : `Incorrect OTP. You have ${attemptsLeft} attempts left.`
      },
      { status: 400 }
    );
  }

  const existingProfile = await findProfileByPhone(adminSupabase, normalizedPhone);

  if (parsed.data.mode === "login" && !existingProfile) {
    return NextResponse.json(
      {
        message: "This mobile number is not registered yet. Please create your account first."
      },
      { status: 404 }
    );
  }

  const fallbackName =
    existingProfile?.name?.trim() ||
    otpRequest.name?.trim() ||
    `Customer ${normalizedPhone.slice(-4)}`;
  const fullName =
    parsed.data.mode === "signup" && parsed.data.name?.trim()
      ? parsed.data.name.trim()
      : fallbackName;

  const { password } = await ensureOtpCustomerUser({
    supabase: adminSupabase,
    normalizedPhone,
    fullName,
    existingProfile
  });

  const { data: signInData, error: signInError } = await routeSupabase.auth.signInWithPassword({
    phone: normalizedPhone,
    password
  });

  if (signInError || !signInData.session || !signInData.user) {
    return NextResponse.json(
      {
        message: "OTP was verified, but your session could not be started. Please try again."
      },
      { status: 500 }
    );
  }

  await adminSupabase.from("phone_otp_requests").delete().eq("phone", normalizedPhone);

  return response;
});
