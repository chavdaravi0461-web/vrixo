"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, ArrowRight, Sparkles } from "lucide-react";

export function AnimatedLoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, password, next: "/account" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Login failed");
        setLoading(false);
        return;
      }
      router.push(data.redirectTo || "/account");
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <style>{keyframes}</style>

      <div style={styles.container}>

        {/* ─── LEFT: Animated Illustration ─── */}
        <div style={styles.leftPanel}>
          <div style={styles.illustrationWrapper}>

            {/* Floating particles */}
            <div style={{ ...styles.particle, ...styles.p1 }} />
            <div style={{ ...styles.particle, ...styles.p2 }} />
            <div style={{ ...styles.particle, ...styles.p3 }} />
            <div style={{ ...styles.particle, ...styles.p4 }} />
            <div style={{ ...styles.particle, ...styles.p5 }} />

            {/* Animated character - CSS 3D figure */}
            <div style={styles.character}>

              {/* Shadow */}
              <div style={styles.characterShadow} />

              {/* Body */}
              <div style={styles.body}>

                {/* Head */}
                <div style={styles.head}>
                  <div style={styles.hair} />
                  <div style={styles.face}>
                    <div style={styles.eyeLeft} />
                    <div style={styles.eyeRight} />
                    <div style={styles.smile} />
                  </div>
                </div>

                {/* Neck */}
                <div style={styles.neck} />

                {/* Torso */}
                <div style={styles.torso}>
                  <div style={styles.shirt} />
                  <div style={styles.tie} />
                </div>

                {/* Left Arm */}
                <div style={styles.leftArm}>
                  <div style={styles.leftHand} />
                </div>

                {/* Right Arm */}
                <div style={styles.rightArm}>
                  <div style={styles.rightHand} />
                </div>

                {/* Legs */}
                <div style={styles.legs}>
                  <div style={styles.leftLeg}>
                    <div style={styles.leftShoe} />
                  </div>
                  <div style={styles.rightLeg}>
                    <div style={styles.rightShoe} />
                  </div>
                </div>
              </div>

              {/* Briefcase */}
              <div style={styles.briefcase}>
                <div style={styles.briefcaseHandle} />
                <div style={styles.briefcaseLock} />
              </div>
            </div>

            {/* Ground reflection */}
            <div style={styles.ground} />
          </div>

          {/* Text overlay */}
          <div style={styles.illustrationText}>
            <h2 style={styles.illustrationTitle}>Welcome Back</h2>
            <p style={styles.illustrationSub}>Sign in to continue your premium experience</p>
          </div>
        </div>

        {/* ─── RIGHT: Login Form ─── */}
        <div style={styles.rightPanel}>
          <div style={styles.formWrapper}>

            {/* Brand */}
            <Link href="/" style={styles.brandLink}>
              <span style={styles.brandText}>VRIXO</span>
            </Link>
            <p style={styles.brandTag}>LUXURY REDEFINED</p>

            {/* Heading */}
            <div style={styles.heading}>
              <h1 style={styles.title}>Sign in</h1>
              <p style={styles.subtitle}>Enter your credentials to access your account</p>
            </div>

            {/* Error */}
            {error && (
              <div style={styles.errorBox}>
                <span style={{ fontSize: "14px" }}>&#9888;</span>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  style={styles.input}
                  onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.target.style.borderColor = "#c9a84c"}
                  onBlur={(e: React.FocusEvent<HTMLInputElement>) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    style={{ ...styles.input, paddingRight: "44px" }}
                    onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.target.style.borderColor = "#c9a84c"}
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    aria-label={showPassword ? "Hide" : "Show"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ textAlign: "right", marginTop: "-4px", marginBottom: "24px" }}>
                <Link href="/forgot-password" style={styles.forgotLink}>
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.submitBtn,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                    Signing in...
                  </span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    Sign in
                    <ArrowRight size={18} />
                  </span>
                )}
              </button>
            </form>

            {/* Divider */}
            <div style={styles.divider}>
              <span style={styles.dividerText}>or continue with</span>
            </div>

            {/* Google */}
            <button
              onClick={() => {
                void (async () => {
                  const { signIn } = await import("next-auth/react");
                  const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl") || "/account";
                  signIn("google", { callbackUrl });
                })();
              }}
              style={styles.googleBtn}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            {/* Signup link */}
            <p style={styles.signupText}>
              Don&apos;t have an account?{" "}
              <Link href="/signup" style={styles.signupLink}>Create one</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const keyframes = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-12px); }
  }
  @keyframes floatSlow {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-8px) rotate(3deg); }
  }
  @keyframes breathe {
    0%, 100% { transform: scaleY(1); }
    50% { transform: scaleY(1.02); }
  }
  @keyframes blink {
    0%, 90%, 100% { transform: scaleY(1); }
    95% { transform: scaleY(0.1); }
  }
  @keyframes wave {
    0%, 100% { transform: rotate(-5deg); }
    50% { transform: rotate(15deg); }
  }
  @keyframes particleFloat {
    0%, 100% { transform: translateY(0) translateX(0) scale(1); opacity: 0.6; }
    33% { transform: translateY(-30px) translateX(10px) scale(1.2); opacity: 1; }
    66% { transform: translateY(-15px) translateX(-8px) scale(0.8); opacity: 0.4; }
  }
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideLeft {
    from { opacity: 0; transform: translateX(30px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }
  @keyframes groundPulse {
    0%, 100% { transform: scaleX(1); opacity: 0.15; }
    50% { transform: scaleX(1.1); opacity: 0.25; }
  }
`;

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0a0a0a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "20px",
    overflow: "hidden",
  },
  container: {
    display: "flex",
    width: "100%",
    maxWidth: "960px",
    minHeight: "600px",
    borderRadius: "24px",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 120px rgba(201,168,76,0.03)",
    animation: "slideUp 0.8s ease-out",
  },

  /* ─── LEFT PANEL ─── */
  leftPanel: {
    flex: "1",
    background: "linear-gradient(160deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 32px",
    position: "relative",
    overflow: "hidden",
  },
  illustrationWrapper: {
    position: "relative",
    width: "260px",
    height: "300px",
    animation: "floatSlow 6s ease-in-out infinite",
  },

  /* Particles */
  particle: {
    position: "absolute",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  p1: {
    width: "8px", height: "8px",
    background: "rgba(201,168,76,0.6)",
    top: "10%", left: "15%",
    animation: "particleFloat 4s ease-in-out infinite",
  },
  p2: {
    width: "6px", height: "6px",
    background: "rgba(99,102,241,0.5)",
    top: "20%", right: "10%",
    animation: "particleFloat 5s ease-in-out infinite 0.5s",
  },
  p3: {
    width: "10px", height: "10px",
    background: "rgba(201,168,76,0.3)",
    bottom: "25%", left: "8%",
    animation: "particleFloat 6s ease-in-out infinite 1s",
  },
  p4: {
    width: "5px", height: "5px",
    background: "rgba(255,255,255,0.3)",
    top: "40%", right: "20%",
    animation: "particleFloat 4.5s ease-in-out infinite 1.5s",
  },
  p5: {
    width: "7px", height: "7px",
    background: "rgba(201,168,76,0.4)",
    bottom: "15%", right: "15%",
    animation: "particleFloat 5.5s ease-in-out infinite 2s",
  },

  /* Character */
  character: {
    position: "absolute",
    bottom: "40px",
    left: "50%",
    transform: "translateX(-50%)",
    animation: "float 4s ease-in-out infinite",
  },
  characterShadow: {
    position: "absolute",
    bottom: "-8px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "60px",
    height: "10px",
    borderRadius: "50%",
    background: "rgba(0,0,0,0.3)",
    animation: "groundPulse 4s ease-in-out infinite",
  },

  /* Body parts */
  body: {
    position: "relative",
    width: "80px",
    animation: "breathe 3s ease-in-out infinite",
  },
  head: {
    position: "relative",
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "#f4c89a",
    margin: "0 auto",
    zIndex: 2,
  },
  hair: {
    position: "absolute",
    top: "-3px",
    left: "-2px",
    right: "-2px",
    height: "22px",
    borderRadius: "50% 50% 0 0",
    background: "#d4a043",
  },
  face: {
    position: "absolute",
    top: "14px",
    left: "6px",
    right: "6px",
    height: "20px",
  },
  eyeLeft: {
    position: "absolute",
    left: "4px",
    top: "4px",
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    background: "#1a1a2e",
    animation: "blink 4s ease-in-out infinite",
  },
  eyeRight: {
    position: "absolute",
    right: "4px",
    top: "4px",
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    background: "#1a1a2e",
    animation: "blink 4s ease-in-out infinite 0.1s",
  },
  smile: {
    position: "absolute",
    bottom: "2px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "10px",
    height: "5px",
    borderRadius: "0 0 10px 10px",
    background: "transparent",
    borderBottom: "2px solid #c0826d",
  },
  neck: {
    width: "8px",
    height: "6px",
    background: "#e8b88a",
    margin: "0 auto",
  },
  torso: {
    position: "relative",
    width: "44px",
    height: "50px",
    background: "linear-gradient(180deg, #1e293b, #334155)",
    borderRadius: "8px 8px 4px 4px",
    margin: "0 auto",
    overflow: "hidden",
  },
  shirt: {
    position: "absolute",
    top: "0",
    left: "50%",
    transform: "translateX(-50%)",
    width: "0",
    height: "0",
    borderLeft: "10px solid transparent",
    borderRight: "10px solid transparent",
    borderTop: "12px solid #e2e8f0",
  },
  tie: {
    position: "absolute",
    top: "12px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "6px",
    height: "20px",
    background: "#c9a84c",
    borderRadius: "0 0 3px 3px",
  },
  leftArm: {
    position: "absolute",
    top: "42px",
    left: "-14px",
    width: "16px",
    height: "40px",
    background: "linear-gradient(180deg, #1e293b, #334155)",
    borderRadius: "8px",
    transformOrigin: "top center",
    animation: "wave 3s ease-in-out infinite",
    zIndex: 1,
  },
  leftHand: {
    position: "absolute",
    bottom: "-4px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: "#f4c89a",
  },
  rightArm: {
    position: "absolute",
    top: "42px",
    right: "-14px",
    width: "16px",
    height: "40px",
    background: "linear-gradient(180deg, #1e293b, #334155)",
    borderRadius: "8px",
    transformOrigin: "top center",
    transform: "rotate(-10deg)",
    zIndex: 3,
  },
  rightHand: {
    position: "absolute",
    bottom: "-4px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: "#f4c89a",
  },
  legs: {
    display: "flex",
    justifyContent: "center",
    gap: "4px",
    marginTop: "-2px",
  },
  leftLeg: {
    width: "16px",
    height: "40px",
    background: "linear-gradient(180deg, #1e293b, #0f172a)",
    borderRadius: "4px",
  },
  rightLeg: {
    width: "16px",
    height: "40px",
    background: "linear-gradient(180deg, #1e293b, #0f172a)",
    borderRadius: "4px",
  },
  leftShoe: {
    width: "20px",
    height: "8px",
    background: "#1a1a2e",
    borderRadius: "4px 10px 4px 4px",
    marginTop: "-1px",
  },
  rightShoe: {
    width: "20px",
    height: "8px",
    background: "#1a1a2e",
    borderRadius: "10px 4px 4px 4px",
    marginTop: "-1px",
  },

  /* Briefcase */
  briefcase: {
    position: "absolute",
    bottom: "28px",
    right: "-20px",
    width: "36px",
    height: "28px",
    background: "linear-gradient(135deg, #92400e, #78350f)",
    borderRadius: "4px",
    border: "1px solid #a16207",
    zIndex: 2,
    animation: "float 3s ease-in-out infinite 0.5s",
  },
  briefcaseHandle: {
    position: "absolute",
    top: "-6px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "14px",
    height: "8px",
    borderRadius: "4px 4px 0 0",
    border: "2px solid #a16207",
    borderBottom: "none",
  },
  briefcaseLock: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "8px",
    height: "6px",
    borderRadius: "2px",
    background: "#c9a84c",
  },

  /* Ground */
  ground: {
    position: "absolute",
    bottom: "28px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "120px",
    height: "4px",
    borderRadius: "50%",
    background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)",
    animation: "pulse 3s ease-in-out infinite",
  },

  illustrationText: {
    textAlign: "center",
    marginTop: "16px",
    zIndex: 2,
  },
  illustrationTitle: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#ffffff",
    margin: 0,
    letterSpacing: "-0.02em",
  },
  illustrationSub: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.5)",
    marginTop: "6px",
  },

  /* ─── RIGHT PANEL ─── */
  rightPanel: {
    flex: "1",
    background: "#111111",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 40px",
  },
  formWrapper: {
    width: "100%",
    maxWidth: "360px",
    animation: "slideLeft 0.8s ease-out 0.2s both",
  },

  brandLink: {
    textDecoration: "none",
    display: "inline-block",
  },
  brandText: {
    fontSize: "28px",
    fontWeight: 800,
    color: "#ffffff",
    letterSpacing: "0.08em",
  },
  brandTag: {
    fontSize: "9px",
    color: "rgba(201,168,76,0.6)",
    letterSpacing: "0.3em",
    marginTop: "2px",
    marginBottom: "36px",
  },

  heading: {
    marginBottom: "28px",
  },
  title: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#ffffff",
    margin: 0,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.4)",
    marginTop: "6px",
  },

  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 16px",
    borderRadius: "10px",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.2)",
    color: "#ef4444",
    fontSize: "13px",
    marginBottom: "20px",
  },

  fieldGroup: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "rgba(255,255,255,0.6)",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    color: "#ffffff",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  },
  eyeBtn: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.4)",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
  },
  forgotLink: {
    fontSize: "12px",
    color: "#c9a84c",
    textDecoration: "none",
    fontWeight: 500,
  },

  submitBtn: {
    width: "100%",
    padding: "14px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg, #c9a84c, #b8942e)",
    color: "#0a0a0a",
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    transition: "all 0.2s",
  },

  divider: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    margin: "24px 0",
  },
  dividerText: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.3)",
    whiteSpace: "nowrap",
  },

  googleBtn: {
    width: "100%",
    padding: "14px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    transition: "all 0.2s",
  },

  signupText: {
    textAlign: "center",
    marginTop: "24px",
    fontSize: "14px",
    color: "rgba(255,255,255,0.4)",
  },
  signupLink: {
    color: "#c9a84c",
    textDecoration: "none",
    fontWeight: 600,
  },
};
