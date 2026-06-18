import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { SignupForm } from "@/components/auth/SignupForm";
import Link from "next/link";

export const metadata = { title: "Sign up - Vrixo" };

export default async function SignupPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;
  if (session) redirect(params?.callbackUrl || "/account");

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: "440px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>VRIXO</span>
          </Link>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
