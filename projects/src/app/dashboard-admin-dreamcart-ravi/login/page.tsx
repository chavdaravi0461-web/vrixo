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
    <section className="admin-page grid min-h-screen place-items-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_460px] lg:items-center">
        <div className="admin-hero p-7 md:p-10">
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200">Admin access</p>
            <h1 className="mt-4 text-4xl font-black leading-tight text-white md:text-6xl">Vrixo owner workspace</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-200">
              Login with an admin account. If the extra gate is enabled, include the private access code.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["Protected login", "Private gate", "Secure session"].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm font-bold text-white">
                  {item}
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
