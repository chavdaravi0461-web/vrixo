import "server-only";
import { forbidden } from "@/lib/api-response";

export function requireSameOrigin(request: Request) {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const source = origin || referer;

  if (!source) {
    return forbidden();
  }

  let sourceOrigin: string;
  try {
    sourceOrigin = new URL(source).origin;
  } catch {
    return forbidden();
  }

  const allowedOrigins = new Set([requestUrl.origin]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      allowedOrigins.add(new URL(appUrl).origin);
    } catch {
      // Invalid NEXT_PUBLIC_APP_URL should not break admin requests from the same origin.
    }
  }

  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.add("http://localhost:3000");
    allowedOrigins.add("http://127.0.0.1:3000");
    allowedOrigins.add("http://localhost:5050");
    allowedOrigins.add("http://127.0.0.1:5050");
  }

  return allowedOrigins.has(sourceOrigin) ? null : forbidden();
}
