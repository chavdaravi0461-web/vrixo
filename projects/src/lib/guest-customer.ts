import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeIndianMobileNumber, getIndianMobileLookupVariants } from "@/lib/phone";

type CheckoutUserResult = {
  userId: string;
  isNewUser: boolean;
  tempPassword?: string;
};

export async function ensureCheckoutUser({
  email,
  name,
  phone,
}: {
  email: string;
  name: string;
  phone?: string;
}): Promise<CheckoutUserResult> {
  const supabase = createAdminClient();
  const normalizedPhone = phone ? normalizeIndianMobileNumber(phone) : null;
  const lowerEmail = email.toLowerCase().trim();

  if (!lowerEmail) {
    throw new Error("Email is required for checkout.");
  }

  // 1. Check profiles by email (fast, indexed)
  const { data: existingByEmail, error: emailLookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", lowerEmail)
    .limit(1)
    .maybeSingle();

  if (emailLookupError) {
    console.warn("[ensureCheckoutUser] profiles_email_lookup_error", emailLookupError.message);
  }

  if (existingByEmail?.id) {
    return { userId: existingByEmail.id, isNewUser: false };
  }

  // 2. Create new auth user with real email + random password
  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: lowerEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name, phone: normalizedPhone || "", checkoutCreated: true },
  });

  if (createError || !created?.user) {
    const msg = createError?.message ?? "";
    console.warn("[ensureCheckoutUser] createUser_failed", { email: lowerEmail, error: msg });

    if (msg.toLowerCase().includes("already")) {
      // User already exists in auth but not in profiles — try profiles lookup again
      const { data: retryProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", lowerEmail)
        .limit(1)
        .maybeSingle();

      if (retryProfile?.id) {
        return { userId: retryProfile.id, isNewUser: false };
      }

      // Create profile for existing auth user — we need the user ID
      // Use a direct query to find by email
      const { data: authUser } = await supabase.auth.admin.getUserById(created?.user?.id ?? "");
      if (authUser?.user) {
        await supabase.from("profiles").upsert({
          id: authUser.user.id, name, email: lowerEmail,
          phone: normalizedPhone || "", role: "customer", is_active: true,
        }, { onConflict: "id" });
        return { userId: authUser.user.id, isNewUser: false };
      }

      // Last resort — throw with descriptive message
      throw new Error("Account exists but could not be accessed. Please login first.");
    }
    throw new Error(msg || "Could not create customer account.");
  }

  // 3. Upsert profile
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: created.user.id, name, email: lowerEmail,
    phone: normalizedPhone || "", role: "customer", is_active: true,
  }, { onConflict: "id" });

  if (profileError) {
    console.error("[ensureCheckoutUser] profile_upsert_failed", profileError.message);
    await supabase.auth.admin.deleteUser(created.user.id).catch(() => null);
    throw new Error(profileError.message);
  }

  return { userId: created.user.id, isNewUser: true, tempPassword };
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < 16; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}
