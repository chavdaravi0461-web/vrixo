import Link from "next/link";

export const metadata = { title: "Authentication Error - Vrixo" };

export default async function AuthErrorPage({ searchParams }) {
  const params = await searchParams;
  const errorMessages = {
    OAuthSignin: "There was a problem starting the Google sign-in process.",
    OAuthCallback: "Google sign-in could not be completed.",
    OAuthCreateAccount: "Could not create your account with Google.",
    EmailCreateAccount: "Could not create your account with this email.",
    Callback: "The sign-in callback failed.",
    OAuthAccountNotLinked: "This email is already associated with another sign-in method.",
    EmailSignin: "The sign-in link could not be sent.",
    CredentialsSignin: "The email or password you entered is incorrect.",
    SessionRequired: "Please sign in to access this page.",
    Default: "An authentication error occurred.",
  };

  const errorType = params?.error || "Default";
  const message = errorMessages[errorType] || errorMessages.Default;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", padding: "20px" }}>
      <div className="glass-card" style={{ maxWidth: "440px", width: "100%", padding: "40px", textAlign: "center" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>Sign in failed</h1>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "24px", lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Link href="/login" className="hero-btn hero-btn-primary" style={{ textAlign: "center" }}>Try again</Link>
          <Link href="/" className="hero-btn hero-btn-ghost" style={{ textAlign: "center" }}>Go home</Link>
        </div>
      </div>
    </div>
  );
}
