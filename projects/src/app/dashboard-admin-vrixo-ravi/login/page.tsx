import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { buildMetadata } from "@/lib/metadata";
import { getCurrentProfile } from "@/lib/auth";
import { isOwnerAdminEmail, PRIVATE_ADMIN_PATH } from "@/lib/admin-constants";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-auth";

export const metadata = {
  ...buildMetadata("Admin Login"),
  robots: { index: false, follow: false }
};
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const cookieStore = await cookies();
  const adminGateUnlocked = Boolean(
    verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value)
  );
  const profile = await getCurrentProfile();
  if (
    adminGateUnlocked &&
    profile?.role === "admin" &&
    profile.is_active !== false &&
    isOwnerAdminEmail(profile.email)
  ) {
    redirect(PRIVATE_ADMIN_PATH);
  }

  return (
    <section className="os-page grid min-h-screen place-items-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_460px] lg:items-center">
        <div className="os-hero p-6 md:p-8">
          <div className="relative z-10">
            <div className="flex items-center gap-2">
              <span className="os-dot live" />
              <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--os-text-3)]">Admin Access</span>
            </div>
            <h1 className="mt-4 text-3xl font-bold text-white md:text-4xl tracking-tight">Owner Workspace</h1>
            <p className="mt-2 max-w-xl text-sm text-[var(--os-text-3)]">
              Login with an admin account. If the extra gate is enabled, include the private access code.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              {["Protected Login", "Private Gate", "Secure Session"].map((item) => (
                <div key={item} className="os-qa">
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <AdminLoginForm />
      </div>
    </section>
  );
}
