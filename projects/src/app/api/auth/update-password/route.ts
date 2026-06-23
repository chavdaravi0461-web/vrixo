import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import { checkServerRateLimit } from "@/lib/rate-limit";

const sessionSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters."),
  accessToken: z.string().min(20),
});

const tokenSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters."),
  email: z.string().email(),
  resetToken: z.string().min(50, "Invalid reset token."),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkServerRateLimit(request, { key: "update-password", limit: 5, windowMs: 10 * 60 * 1000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ message: "Too many attempts. Try again later." }, { status: 429 });
    }

    const body = await request.json().catch(() => null);

    // Try session-based auth first (browser client sends access token)
    const sessionParsed = sessionSchema.safeParse(body);
    if (sessionParsed.success) {
      const { password, accessToken } = sessionParsed.data;

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({ message: "Server configuration error." }, { status: 500 });
      }

      const supabase = createClient(supabaseUrl, serviceKey);
      const tokenClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data: userData, error: userError } = await tokenClient.auth.getUser(accessToken);

      if (userError || !userData?.user?.id) {
        return NextResponse.json({ message: "Invalid session. Please try again." }, { status: 401 });
      }

      const { error: updateError } = await supabase.auth.admin.updateUserById(userData.user.id, {
        password,
        email_confirm: true,
      });

      if (updateError) {
        console.error("[update-password] admin update failed:", updateError.message);
        return NextResponse.json({ message: "Could not update password. Please try again." }, { status: 400 });
      }

      return NextResponse.json({ message: "Password updated successfully." });
    }

    // Fallback: token-based reset (email + OTP token)
    const tokenParsed = tokenSchema.safeParse(body);
    if (!tokenParsed.success) {
      return NextResponse.json({ message: "Invalid input. Please provide valid credentials." }, { status: 400 });
    }

    const { password, email, resetToken } = tokenParsed.data;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return NextResponse.json({ message: "Server configuration error." }, { status: 500 });
    }

    const tokenClient = createClient(supabaseUrl, anonKey);
    const { data: verifyData, error: verifyError } = await tokenClient.auth.verifyOtp({
      email,
      token: resetToken,
      type: "recovery",
    });

    if (verifyError || !verifyData?.session) {
      console.warn("[update-password] token verification failed", JSON.stringify({ email, error: verifyError?.message }));
      return NextResponse.json({ message: "Invalid or expired reset link. Please request a new one." }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const userId = verifyData.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Could not identify your account. Please request a new reset link." }, { status: 400 });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });

    if (updateError) {
      console.error("[update-password] admin update failed:", updateError.message);
      return NextResponse.json({ message: "Could not update password. Please try again." }, { status: 400 });
    }

    try {
      await supabase.auth.admin.signOut(userId);
    } catch { /* Non-critical */ }

    return NextResponse.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("[update-password]", JSON.stringify({ message: "unhandled_error", error: err instanceof Error ? err.message : String(err) }));
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
