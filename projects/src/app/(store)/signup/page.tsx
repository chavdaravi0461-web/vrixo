import { redirect } from "next/navigation";
import { AuthForm } from "@/components/store/auth-form";
import { buildMetadata } from "@/lib/metadata";
import { getCurrentUser } from "@/lib/auth";
import { sanitizeRedirectPath } from "@/lib/safe-navigation";

export const metadata = buildMetadata("Sign Up");
export const dynamic = "force-dynamic";

export default async function SignupPage({
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
        <div className="overflow-hidden rounded-[2.5rem] bg-slate-950 p-8 text-white shadow-[0_24px_70px_-30px_rgba(15,23,42,0.6)] sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-300">Create account</p>
          <h1 className="mt-4 font-serif text-4xl font-semibold sm:text-5xl">Create your Vrixo account</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
            Sign up with your email, mobile number, and password to unlock faster checkout, order history, and secure account access.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <InfoTile title="Email or mobile login" description="Return anytime with your registered email/mobile number and password." />
            <InfoTile title="Order history" description="Track every Vrixo purchase from your account dashboard." />
            <InfoTile title="Secure checkout" description="Keep your profile details ready for a quicker checkout experience." />
          </div>
        </div>
        <div>
          <AuthForm mode="signup" redirectTo={redirectTo} />
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
    <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.08] p-5">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
    </div>
  );
}
