import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters."),
  email: z.string().email().optional(),
  resetToken: z.string().min(50, "Invalid reset token.").optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid password." }, { status: 400 });
    }

    const { password, email, resetToken } = parsed.data;

    if (!resetToken) {
      return NextResponse.json(
        { message: "Reset token is required. Please use the link from your email." },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ message: "Server configuration error." }, { status: 500 });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, serviceKey);

    let targetEmail = email;

    if (!targetEmail) {
      return NextResponse.json(
        { message: "Could not identify your account. Please request a new reset link." },
        { status: 400 }
      );
    }

    const { data: userData, error: userError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    const targetUser = userData?.users?.find(
      (u) => u.email?.toLowerCase() === targetEmail!.toLowerCase()
    );

    if (!targetUser || userError) {
      return NextResponse.json(
        { message: "Account not found. Please request a new reset link." },
        { status: 404 }
      );
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(targetUser.id, {
      password: password,
      email_confirm: true,
    });

    if (updateError) {
      console.error("[update-password] admin update failed:", updateError.message);
      return NextResponse.json(
        { message: "Could not update password. Please try again." },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("[update-password]", JSON.stringify({ message: "unhandled_error", error: err instanceof Error ? err.message : String(err) }));
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
