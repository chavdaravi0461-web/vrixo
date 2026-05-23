"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { SupabaseSetupNote } from "@/components/store/supabase-setup-note";
import { isSupabaseConfigured } from "@/lib/utils";
import { normalizeIndianMobileNumber } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { z } from "zod";

type AuthMode = "login" | "signup";
type AuthValues = {
  name: string;
  phone: string;
  email: string;
  identifier: string;
  password: string;
};

export function AuthForm({
  mode,
  redirectTo = "/account"
}: {
  mode: AuthMode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    router.prefetch(redirectTo);
  }, [redirectTo, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<AuthValues>({
    resolver: zodResolver(createAuthFormSchema(mode)),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      identifier: "",
      password: ""
    }
  });

  return (
    <form
      className="rounded-[2rem] bg-white p-8 card-shadow"
      onSubmit={handleSubmit(async (values) => {
        try {
          if (!configured) {
            throw new Error(
              "Account access is temporarily unavailable. Please contact support."
            );
          }

          if (mode === "signup") {
            const normalizedPhone = normalizeIndianMobileNumber(values.phone) ?? values.phone.trim();
            const response = await fetch("/api/auth/password-signup", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                name: values.name,
                phone: normalizedPhone,
                email: values.email,
                password: values.password,
                next: redirectTo
              })
            });

            const payload = (await response.json().catch(() => null)) as
              | {
                  message?: string;
                  redirectTo?: string;
                }
              | null;

            if (!response.ok) {
              throw new Error(payload?.message ?? "Account could not be created. Please try again.");
            }

            toast.success("Account created. You are logged in.");
            window.location.replace(payload?.redirectTo ?? redirectTo);
            return;
          }

          const response = await fetch("/api/auth/password-login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              identifier: values.identifier,
              password: values.password,
              next: redirectTo
            })
          });

          const payload = (await response.json().catch(() => null)) as
            | {
                message?: string;
                redirectTo?: string;
              }
            | null;

          if (!response.ok) {
            throw new Error(payload?.message ?? "Login could not be completed. Please try again.");
          }

          window.location.replace(payload?.redirectTo ?? redirectTo);
        } catch (error) {
          toast.error(getAuthErrorMessage(error));
        }
      })}
    >
      <div className="space-y-4">
        {!configured ? <SupabaseSetupNote /> : null}
        {mode === "signup" ? (
          <>
            <Field label="Full name" error={errors.name?.message}>
              <Input {...register("name")} />
            </Field>
            <Field label="Phone number" error={errors.phone?.message}>
              <Input {...register("phone")} />
            </Field>
          </>
        ) : null}
        {mode === "signup" ? (
          <Field label="Email" error={errors.email?.message}>
            <Input
              type="email"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              {...register("email")}
            />
          </Field>
        ) : (
          <Field label="Email or mobile number" error={errors.identifier?.message}>
            <Input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              inputMode="text"
              spellCheck={false}
              placeholder="Email or mobile number"
              {...register("identifier")}
            />
          </Field>
        )}
        <Field label="Password" error={errors.password?.message}>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="pr-12"
              {...register("password")}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
      </div>
      <Button type="submit" className="mt-6 w-full" disabled={isSubmitting || !configured}>
        {!configured
          ? "Account access unavailable"
          : isSubmitting
            ? mode === "signup"
              ? "Creating account..."
              : "Logging in..."
            : mode === "signup"
              ? "Create account"
              : "Login"}
      </Button>
      <p className="mt-4 text-center text-sm text-slate-600">
        {mode === "signup" ? "Already have an account?" : "New to Vrixo?"}{" "}
        <Link
          href={mode === "signup" ? "/login" : "/signup"}
          className="font-semibold text-teal-700"
        >
          {mode === "signup" ? "Login" : "Create account"}
        </Link>
      </p>
    </form>
  );
}

function createAuthFormSchema(mode: AuthMode) {
  return z
    .object({
      name: z.string().trim(),
      phone: z.string().trim(),
      email: z.string().trim().toLowerCase(),
      identifier: z.string().trim(),
      password: z.string().min(6, "Password must be at least 6 characters.")
    })
    .superRefine((values, ctx) => {
      if (mode === "signup") {
        if (values.name.length < 2) {
          ctx.addIssue({
            code: "custom",
            path: ["name"],
            message: "Enter your full name."
          });
        }

        if (!z.email().safeParse(values.email).success) {
          ctx.addIssue({
            code: "custom",
            path: ["email"],
            message: "Enter a valid email address."
          });
        }

        if (!normalizeIndianMobileNumber(values.phone)) {
          ctx.addIssue({
            code: "custom",
            path: ["phone"],
            message: "Enter a valid Indian mobile number."
          });
        }

        return;
      }

      if (values.identifier.length < 3) {
        ctx.addIssue({
          code: "custom",
          path: ["identifier"],
          message: "Enter your email or mobile number."
        });
      }
    });
}

function getAuthErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Authentication failed.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "Email/mobile number or password is incorrect.";
  }

  if (message.includes("email not confirmed")) {
    return "Please confirm your email before logging in.";
  }

  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  if (message.includes("supabase") || message.includes(".env")) {
    return "Account access is temporarily unavailable. Please contact support.";
  }

  return error.message;
}

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {error ? <span className="mt-2 block text-sm text-red-600">{error}</span> : null}
    </label>
  );
}
