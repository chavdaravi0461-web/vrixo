import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
// @ts-expect-error — firebase/users.js has no type declarations
import { updateUser } from "@/lib/firebase/users";

const schema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters."),
  email: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid password." }, { status: 400 });
    }

    const { password, email } = parsed.data;
    const admin = createAdminClient();

    let targetEmail = email;

    // If no email passed, try to get from session cookies
    if (!targetEmail) {
      const { NextResponse: NR } = await import("next/server");
      const dummyResponse = NR.json({});
      const { createRouteHandlerSupabaseClient } = await import("@/lib/supabase/route");
      const supabase = createRouteHandlerSupabaseClient(request, dummyResponse);
      const { data: { user } } = await supabase.auth.getUser();
      targetEmail = user?.email || undefined;
    }

    if (!targetEmail) {
      return NextResponse.json(
        { message: "Could not identify your account. Please request a new reset link." },
        { status: 400 }
      );
    }

    // Look up user by email using admin client
    const { data: usersList, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    const targetUser = usersList?.users?.find(
      (u) => u.email?.toLowerCase() === targetEmail!.toLowerCase()
    );

    if (!targetUser || listError) {
      return NextResponse.json(
        { message: "Account not found. Please request a new reset link." },
        { status: 404 }
      );
    }

    // Update password AND confirm email using admin client
    const { error: updateError } = await admin.auth.admin.updateUserById(targetUser.id, {
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

    // Also update Firebase password so NextAuth login works
    await updateUser(targetEmail, { password }).catch((err: any) => {
      console.error("[update-password] firebase sync failed (non-fatal):", err?.message);
    });

    return NextResponse.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("[update-password]", JSON.stringify({ message: "unhandled_error", error: err instanceof Error ? err.message : String(err) }));
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
