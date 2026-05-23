import { redirect } from "next/navigation";
import { AccountShell } from "@/components/store/account-shell";
import { ProfileForm } from "@/components/store/profile-form";
import { EmptyState } from "@/components/empty-state";
import { buildMetadata } from "@/lib/metadata";
import { getCurrentProfile } from "@/lib/auth";

export const metadata = buildMetadata("Profile");
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login?next=%2Fprofile");
  }

  return (
    <AccountShell current="/profile" showLogout>
      {profile ? (
        <ProfileForm
          profile={{
            id: profile.id,
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            addresses: profile.addresses ?? []
          }}
        />
      ) : (
        <EmptyState title="Profile unavailable" description="Please login again." ctaLabel="Login" ctaHref="/login" />
      )}
    </AccountShell>
  );
}
