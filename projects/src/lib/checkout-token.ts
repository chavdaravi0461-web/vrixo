import "server-only";
import crypto from "node:crypto";

const tokenVersion = "v1";
const tokenTtlMs = 30 * 60 * 1000;

export function hasCheckoutTokenSecret() {
  return Boolean(process.env.CHECKOUT_TOKEN_SECRET && process.env.CHECKOUT_TOKEN_SECRET.length >= 32);
}

export function createCheckoutToken(orderId: string) {
  const secret = getCheckoutTokenSecret();
  const exp = Date.now() + tokenTtlMs;
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `${tokenVersion}.${orderId}.${exp}.${nonce}`;
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

export function verifyCheckoutToken(token: string | undefined, orderId: string) {
  if (!token) return false;

  if (!hasCheckoutTokenSecret()) return false;
  const secret = getCheckoutTokenSecret();
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== tokenVersion) return false;

  const [, tokenOrderId, expRaw] = parts;
  if (tokenOrderId !== orderId) return false;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;

  const payload = parts.slice(0, 4).join(".");
  const expected = sign(payload, secret);
  const provided = parts[4];

  return timingSafeEqual(expected, provided);
}

function getCheckoutTokenSecret() {
  const secret = process.env.CHECKOUT_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Checkout token configuration is incomplete.");
  }
  return secret;
}

function sign(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
