import { createAdminClient } from "@/lib/supabase/admin";

type GuestCustomerInput = {
  email?: string | null;
  shippingAddress: Record<string, unknown>;
};

export async function createGuestCustomerProfile({ email, shippingAddress }: GuestCustomerInput) {
  const supabase = createAdminClient();
  const guestId = crypto.randomUUID();
  const customerName = String(shippingAddress.fullName ?? "").trim() || "Guest Customer";
  const customerPhone = String(shippingAddress.phone ?? "").trim();
  const orderEmail = String(email ?? "").trim();
  const authEmail = `guest-${guestId}@guest.vrixo.local`;

  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    id: guestId,
    email: authEmail,
    email_confirm: true,
    user_metadata: {
      name: customerName,
      phone: customerPhone,
      checkoutEmail: orderEmail,
      guestCheckout: true
    }
  });

  if (createUserError || !createdUser.user) {
    throw new Error(createUserError?.message ?? "Guest customer could not be created.");
  }

  const { error: profileError } = await upsertGuestProfile({
    supabase,
    id: createdUser.user.id,
    name: customerName,
    email: authEmail,
    phone: customerPhone
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

  return {
    id: createdUser.user.id,
    authEmail,
    orderEmail
  };
}

async function upsertGuestProfile({
  supabase,
  id,
  name,
  email,
  phone
}: {
  supabase: ReturnType<typeof createAdminClient>;
  id: string;
  name: string;
  email: string;
  phone: string;
}) {
  const customerRoleResult = await supabase.from("profiles").upsert({
    id,
    name,
    email,
    phone,
    role: "customer",
    is_active: true
  });

  if (!customerRoleResult.error) {
    return customerRoleResult;
  }

  return customerRoleResult;
}
