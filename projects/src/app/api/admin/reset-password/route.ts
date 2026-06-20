import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseAdminEnv } from "@/lib/env/server";
import { safeRoute } from "@/lib/safe-route";
import { checkServerRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const resetSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  newPassword: z.string().min(6, "Password must be at least 6 characters."),
  accessCode: z.string().trim().min(1, "Access code is required."),
});

export const POST = safeRoute(async function POST(request: NextRequest) {
  const rateLimit = await checkServerRateLimit(request, {
    key: "admin-reset-pw",
    limit: 3,
    windowMs: 30 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  if (!hasServerSupabaseAdminEnv()) {
    return NextResponse.json(
      { message: "Server not configured." },
      { status: 500 }
    );
  }

  const parsed = resetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { email, newPassword, accessCode } = parsed.data;

  const requiredCode = process.env.ADMIN_ACCESS_CODE?.trim();
  if (requiredCode) {
    const inputBuf = Buffer.from(accessCode.padEnd(requiredCode.length, "\0"));
    const requiredBuf = Buffer.from(requiredCode.padEnd(accessCode.length, "\0"));
    if (
      inputBuf.length !== requiredBuf.length ||
      !timingSafeEqual(inputBuf, requiredBuf)
    ) {
      return NextResponse.json(
        { message: "Invalid access code." },
        { status: 401 }
      );
    }
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!profile?.id) {
    return NextResponse.json(
      { message: "No user found with this email." },
      { status: 404 }
    );
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(
    profile.id,
    {
      password: newPassword,
      email_confirm: true,
    }
  );

  if (updateError) {
    console.error("[admin-reset-pw] update_failed", JSON.stringify({ error: updateError.message }));
    return NextResponse.json(
      { message: "Could not update password. Please try again." },
      { status: 500 }
    );
  }

  console.info("[admin-reset-pw] success", JSON.stringify({ email, userId: profile.id }));

  return NextResponse.json({
    message: "Password updated successfully. You can now login.",
  });
});
