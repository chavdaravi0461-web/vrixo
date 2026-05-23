"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { AuthForm } from "@/components/store/auth-form";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { cn, isSupabaseConfigured } from "@/lib/utils";

type PromptMode = "login" | "signup";
type PromptState = "checking" | "open" | "closed";

const SKIP_PATHS = [
  "/login",
  "/signup",
  "/account",
  "/profile",
  "/my-orders",
  "/cart",
  "/checkout",
  "/order-success",
  "/order/track"
];

export function CustomerAuthPrompt() {
  const pathname = usePathname();
  const configured = isSupabaseConfigured();
  const [mode, setMode] = useState<PromptMode>("login");
  const [state, setState] = useState<PromptState>("checking");

  const shouldSkipPath = useMemo(
    () => SKIP_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)),
    [pathname]
  );
  const canPrompt = configured && !shouldSkipPath;

  useEffect(() => {
    if (!canPrompt) {
      return;
    }

    let active = true;
    const supabase = createBrowserSupabaseClient();

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState(data.session ? "closed" : "open");
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState(session ? "closed" : "open");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [canPrompt]);

  useEffect(() => {
    if (state !== "open") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [state]);

  if (!canPrompt || state !== "open") {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-auth-prompt-title"
    >
      <div className="relative max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-[2rem] bg-white shadow-[0_32px_90px_-28px_rgba(15,23,42,0.65)]">
        <button
          type="button"
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-950"
          onClick={() => setState("closed")}
          aria-label="Close account popup"
          title="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-slate-200 bg-slate-50 px-5 pb-5 pt-6 sm:px-7">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
            Customer account
          </p>
          <h2 id="customer-auth-prompt-title" className="mt-2 font-serif text-3xl font-semibold text-slate-950">
            Login or create account
          </h2>
          <p className="mt-2 pr-10 text-sm leading-6 text-slate-600">
            Sign in to track orders, save details, and continue checkout faster.
          </p>

          <div className="mt-5 grid grid-cols-2 rounded-full border border-slate-200 bg-white p-1">
            <PromptTab active={mode === "login"} onClick={() => setMode("login")}>
              Login
            </PromptTab>
            <PromptTab active={mode === "signup"} onClick={() => setMode("signup")}>
              New account
            </PromptTab>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <AuthForm mode={mode} />
        </div>
      </div>
    </div>
  );
}

function PromptTab({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "h-11 rounded-full text-sm font-semibold transition",
        active
          ? "bg-slate-950 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
