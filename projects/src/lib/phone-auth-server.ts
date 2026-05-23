import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getIndianMobileLookupVariants } from "@/lib/phone";
import { makeInternalSupabasePassword } from "@/lib/otp-auth";

type PhoneProfile = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
};

export async function findProfileByPhone(supabase: SupabaseClient, normalizedPhone: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, phone, email")
    .in("phone", getIndianMobileLookupVariants(normalizedPhone))
    .limit(1);

  if (error) {
    throw error;
  }

  return (data?.[0] as PhoneProfile | undefined) ?? null;
}

export async function ensureOtpCustomerUser({
  supabase,
  normalizedPhone,
  fullName,
  existingProfile
}: {
  supabase: SupabaseClient;
  normalizedPhone: string;
  fullName: string;
  existingProfile: PhoneProfile | null;
}) {
  const password = makeInternalSupabasePassword(normalizedPhone);
  let userId = existingProfile?.id ?? null;
  let userEmail = existingProfile?.email ?? null;

  if (userId) {
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      phone: normalizedPhone,
      phone_confirm: true,
      password,
      user_metadata: {
        name: fullName,
        phone: normalizedPhone
      }
    });

    if (error || !data.user) {
      throw error ?? new Error("Existing customer account could not be updated.");
    }

    userId = data.user.id;
    userEmail = data.user.email ?? userEmail;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      phone: normalizedPhone,
      phone_confirm: true,
      password,
      user_metadata: {
        name: fullName,
        phone: normalizedPhone
      }
    });

    if (error || !data.user) {
      throw error ?? new Error("Customer account could not be created.");
    }

    userId = data.user.id;
    userEmail = data.user.email ?? null;
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      name: fullName,
      phone: normalizedPhone,
      email: userEmail
    },
    {
      onConflict: "id"
    }
  );

  if (profileError) {
    throw profileError;
  }

  return {
    userId,
    password
  };
}
