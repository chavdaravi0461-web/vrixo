import { redirect } from "next/navigation";
import { AuthForm } from "@/components/store/auth-form";
import { buildMetadata } from "@/lib/metadata";
import { getCurrentUser } from "@/lib/auth";
import { sanitizeRedirectPath } from "@/lib/safe-navigation";

export const metadata = {
  ...buildMetadata("Login"),
  robots: { index: false, follow: false }
};
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const query = await searchParams;
  const redirectTo = sanitizeRedirectPath(query.next);
  const user = await getCurrentUser();

  if (user) {
    redirect(redirectTo);
  }

  return (
    <section className="container mt-8">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <div className="overflow-hidden rounded-[2.5rem] bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] p-8 text-white shadow-[0_24px_70px_-30px_rgba(15,23,42,0.55)] sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-100">Account access</p>
          <h1 className="mt-4 font-serif text-4xl font-semibold sm:text-5xl">Login with email or mobile number</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-teal-50/90">
            Access your Vrixo account with email/mobile number and password, then continue checkout with your saved details.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <InfoTile title="Secure session" description="Your account stays protected after password verification." />
            <InfoTile title="Order history" description="View past purchases from your account dashboard." />
            <InfoTile title="Logout anytime" description="One-tap sign-out from your customer account." />
          </div>
        </div>
        <div>
          <AuthForm mode="login" redirectTo={redirectTo} />
        </div>
      </div>
    </section>
  );
}

function InfoTile({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/15 bg-white/10 p-5">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-teal-50/80">{description}</p>
    </div>
  );
}
