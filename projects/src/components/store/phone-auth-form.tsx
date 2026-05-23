"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Clock3, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SupabaseSetupNote } from "@/components/store/supabase-setup-note";
import { customerOtpAuthSchema } from "@/lib/validations";
import { formatIndianMobileNumber, normalizeIndianMobileNumber } from "@/lib/phone";
import { isSupabaseConfigured } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { z } from "zod";

type CustomerAuthMode = "login" | "signup";
type CustomerAuthValues = z.infer<typeof customerOtpAuthSchema>;
type PendingAction = "send" | "verify" | "resend" | null;

export function PhoneAuthForm({ mode }: { mode: CustomerAuthMode }) {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [otpRequested, setOtpRequested] = useState(false);
  const [requestedPhone, setRequestedPhone] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [devOtpEnabled, setDevOtpEnabled] = useState(process.env.NODE_ENV !== "production");

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    setValue,
    getValues,
    formState: { errors }
  } = useForm<CustomerAuthValues>({
    resolver: zodResolver(customerOtpAuthSchema),
    defaultValues: {
      name: "",
      phone: "",
      otp: ""
    }
  });

  useEffect(() => {
    router.prefetch("/account");
  }, [router]);

  const busy = pendingAction !== null;
  const activePhone = requestedPhone ?? normalizeIndianMobileNumber(getValues("phone"));
  const formattedPhone = activePhone ? formatIndianMobileNumber(activePhone) : null;

  async function sendOtp(values: CustomerAuthValues, resend = false) {
    const normalizedPhone = normalizeIndianMobileNumber(values.phone);

    if (!normalizedPhone) {
      setError("phone", {
        type: "manual",
        message: "Enter a valid Indian mobile number."
      });
      return;
    }

    if (mode === "signup" && !values.name?.trim()) {
      setError("name", {
        type: "manual",
        message: "Enter your full name."
      });
      return;
    }

    clearErrors(["phone", "name"]);

    const response = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: values.name?.trim() || undefined,
        phone: normalizedPhone,
        mode
      })
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          message?: string;
          developmentMode?: boolean;
        }
      | null;

    if (!response.ok) {
      throw new Error(payload?.message ?? "OTP could not be sent.");
    }

    setValue("phone", normalizedPhone, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true
    });
    setValue("otp", "");
    setOtpRequested(true);
    setRequestedPhone(normalizedPhone);
    setDevOtpEnabled(Boolean(payload?.developmentMode));

    toast.success(
      payload?.message ??
        (resend ? "A fresh OTP was sent to your mobile number." : "OTP sent to your mobile number.")
    );
  }

  async function verifyOtp(values: CustomerAuthValues) {
    const normalizedPhone = requestedPhone ?? normalizeIndianMobileNumber(values.phone);

    if (!normalizedPhone) {
      setOtpRequested(false);
      setRequestedPhone(null);
      setError("phone", {
        type: "manual",
        message: "Enter your mobile number again."
      });
      return;
    }

    if (!values.otp || !/^\d{6}$/.test(values.otp.trim())) {
      setError("otp", {
        type: "manual",
        message: "Enter the 6-digit OTP."
      });
      return;
    }

    clearErrors("otp");

    const response = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: values.name?.trim() || undefined,
        phone: normalizedPhone,
        otp: values.otp.trim(),
        mode
      })
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          message?: string;
          redirectTo?: string;
        }
      | null;

    if (!response.ok) {
      throw new Error(payload?.message ?? "OTP verification failed.");
    }

    window.location.assign(payload?.redirectTo ?? "/account");
  }

  return (
    <form
      className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.35)] backdrop-blur"
      onSubmit={handleSubmit(async (values) => {
        try {
          if (!configured) {
            throw new Error(
              "Account access is temporarily unavailable. Please contact support."
            );
          }

          setPendingAction(otpRequested ? "verify" : "send");

          if (otpRequested) {
            await verifyOtp(values);
            return;
          }

          await sendOtp(values);
        } catch (error) {
          toast.error(getOtpAuthErrorMessage(error));
        } finally {
          setPendingAction(null);
        }
      })}
    >
      <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.18),transparent_45%),linear-gradient(135deg,#f8fafc_0%,#ffffff_72%)] p-6 sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-teal-800">
          <ShieldCheck className="h-3.5 w-3.5" />
          Secure mobile access
        </div>
        <h2 className="mt-4 font-serif text-3xl font-semibold text-slate-950">
          {otpRequested ? "Verify your OTP" : mode === "signup" ? "Create your account" : "Welcome back"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
          {otpRequested
            ? `We sent a 6-digit code to ${formattedPhone ?? "your mobile number"}.`
            : mode === "signup"
              ? "Use your Indian mobile number for secure signup, faster checkout, and order tracking."
              : "Login with a one-time password and continue shopping without remembering a password."}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <FeaturePill
            icon={<Smartphone className="h-4 w-4" />}
            label="Indian mobile only"
          />
          <FeaturePill icon={<Clock3 className="h-4 w-4" />} label="5-minute OTP" />
          <FeaturePill icon={<Sparkles className="h-4 w-4" />} label="Fast account access" />
        </div>
      </div>

      <div className="space-y-5 p-6 sm:p-8">
        {!configured ? <SupabaseSetupNote /> : null}

        {mode === "signup" ? (
          <Field label="Full name" error={errors.name?.message}>
            <Input
              autoComplete="name"
              placeholder="Your full name"
              className="h-14 rounded-[1.35rem]"
              {...register("name")}
            />
          </Field>
        ) : null}

        <Field
          label="Mobile number"
          error={errors.phone?.message}
          hint="Accepted formats: 9876543210, 09876543210, or +91 98765 43210"
        >
          <Input
            type="tel"
            autoComplete="tel"
            inputMode="numeric"
            placeholder="+91 98765 43210"
            disabled={otpRequested}
            className="h-14 rounded-[1.35rem]"
            {...register("phone")}
          />
        </Field>

        {otpRequested ? (
          <Field
            label="OTP"
            error={errors.otp?.message}
            hint="Enter the 6-digit code without spaces."
          >
            <Input
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              className="h-14 rounded-[1.35rem] text-center text-lg tracking-[0.35em]"
              {...register("otp")}
            />
          </Field>
        ) : null}

        {otpRequested ? (
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">OTP expires in 5 minutes.</p>
            <p className="mt-1">
              You get 3 verification attempts before you need to request a new code.
            </p>
            {devOtpEnabled ? (
              <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-amber-800">
                Test OTP is enabled for this preview. Use <strong>123456</strong>.
              </p>
            ) : null}
          </div>
        ) : null}

        <Button type="submit" className="w-full" size="lg" disabled={busy || !configured}>
          {!configured
            ? "Account access unavailable"
            : pendingAction === "send"
              ? "Sending OTP..."
              : pendingAction === "verify"
                ? "Verifying OTP..."
                : otpRequested
                  ? "Verify OTP"
                  : "Send OTP"}
        </Button>

        {otpRequested ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy || !configured}
              onClick={() => {
                setOtpRequested(false);
                setRequestedPhone(null);
                setValue("otp", "");
                clearErrors(["otp", "phone"]);
              }}
            >
              Change mobile number
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy || !configured}
              onClick={async () => {
                try {
                  setPendingAction("resend");
                  await sendOtp(getValues(), true);
                } catch (error) {
                  toast.error(getOtpAuthErrorMessage(error));
                } finally {
                  setPendingAction(null);
                }
              }}
            >
              {pendingAction === "resend" ? "Resending..." : "Resend OTP"}
            </Button>
          </div>
        ) : null}

        <p className="text-center text-sm text-slate-600">
          {mode === "signup" ? "Already have an account?" : "New to Vrixo?"}{" "}
          <Link
            href={mode === "signup" ? "/login" : "/signup"}
            className="font-semibold text-teal-700 transition hover:text-teal-800"
          >
            {mode === "signup" ? "Login with OTP" : "Create account"}
          </Link>
        </p>
      </div>
    </form>
  );
}

function getOtpAuthErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Authentication failed.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("supabase") || message.includes(".env")) {
    return "Account access is temporarily unavailable. Please contact support.";
  }

  return error.message;
}

function FeaturePill({
  icon,
  label
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[1.15rem] border border-white/80 bg-white/80 px-3 py-3 text-sm font-medium text-slate-700 shadow-sm">
      <span className="text-teal-700">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-800">{label}</span>
      {children}
      {error ? <span className="mt-2 block text-sm text-red-600">{error}</span> : null}
      {!error && hint ? <span className="mt-2 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
