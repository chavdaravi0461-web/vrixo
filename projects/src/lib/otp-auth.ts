import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getOptionalServerEnv } from "@/lib/env/server";

export const OTP_EXPIRY_MINUTES = 5;
export const OTP_EXPIRY_SECONDS = OTP_EXPIRY_MINUTES * 60;
export const OTP_MAX_ATTEMPTS = 3;
export const DEVELOPMENT_TEST_OTP = "123456";

export function isDevelopmentOtpMode() {
  return process.env.NODE_ENV !== "production";
}

export function hasOtpAuthSecret() {
  const env = getOptionalServerEnv();
  return Boolean(env.OTP_AUTH_SECRET && env.OTP_AUTH_SECRET.length >= 32);
}

export function generateOtpCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtpCode(phone: string, code: string) {
  return createHmac("sha256", getOtpAuthSecret())
    .update(`${phone}:${code}`)
    .digest("hex");
}

export function isOtpCodeValid({
  phone,
  code,
  hash
}: {
  phone: string;
  code: string;
  hash: string;
}) {
  if (isDevelopmentOtpMode() && code === DEVELOPMENT_TEST_OTP) {
    return true;
  }

  const expectedHash = Buffer.from(hashOtpCode(phone, code), "utf8");
  const storedHash = Buffer.from(hash, "utf8");

  if (expectedHash.length !== storedHash.length) {
    return false;
  }

  return timingSafeEqual(expectedHash, storedHash);
}

export function makeInternalSupabasePassword(phone: string) {
  const digest = createHmac("sha256", getOtpAuthSecret())
    .update(`vrixo-supabase-password:${phone}`)
    .digest("hex");

  return `Vc!${digest.slice(0, 60)}`;
}

function getOtpAuthSecret() {
  const env = getOptionalServerEnv();
  if (env.OTP_AUTH_SECRET && env.OTP_AUTH_SECRET.length >= 32) {
    return env.OTP_AUTH_SECRET;
  }

  if (isDevelopmentOtpMode()) {
    return "vrixo-dev-otp-secret";
  }

  throw new Error("OTP authentication is not configured.");
}
