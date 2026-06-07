import "server-only";
import crypto from "node:crypto";
import { NextResponse } from "next/server";

export function timingSafeEqualString(value: string | null | undefined, expected: string | null | undefined) {
  if (!value || !expected) return false;

  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(valueBuffer, expectedBuffer);
}

export function requireHeaderSecret(
  request: Request,
  headerName: string,
  expectedSecret: string | null | undefined
) {
  if (!expectedSecret || !timingSafeEqualString(request.headers.get(headerName), expectedSecret)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function requireAnyHeaderSecret(
  request: Request,
  headerNames: string[],
  expectedSecrets: Array<string | null | undefined>
) {
  const configuredSecrets = expectedSecrets.filter((secret): secret is string => Boolean(secret));

  if (configuredSecrets.length === 0) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const authorized = headerNames.some((headerName) => {
    const headerValue = request.headers.get(headerName);
    return configuredSecrets.some((secret) => timingSafeEqualString(headerValue, secret));
  });

  return authorized ? null : NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}
