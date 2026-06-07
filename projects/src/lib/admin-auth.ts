import "server-only";
import crypto from "node:crypto";

export const ADMIN_COOKIE_NAME = "dc_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;

type AdminSessionPayload = {
  sub: string;
  email: string;
  role: "admin";
  iat: number;
  exp: number;
  nonce: string;
};

function getAdminSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters.");
  }

  return secret;
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function sign(value: string) {
  return crypto
    .createHmac("sha256", getAdminSessionSecret())
    .update(value)
    .digest("base64url");
}

export function createAdminSessionToken(user: { id: string; email?: string | null }) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    sub: user.id,
    email: user.email ?? "",
    role: "admin",
    iat: now,
    exp: now + ADMIN_SESSION_TTL_SECONDS,
    nonce: crypto.randomBytes(24).toString("base64url")
  };
  const body = toBase64Url(JSON.stringify(payload));

  return `${body}.${sign(body)}`;
}

export function verifyAdminSessionToken(token?: string | null) {
  if (!token) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  try {
    const expected = sign(body);
    const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AdminSessionPayload;
    const now = Math.floor(Date.now() / 1000);

    if (!payload.sub || payload.role !== "admin" || payload.exp <= now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS
  };
}

export function expiredAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 0
  };
}
