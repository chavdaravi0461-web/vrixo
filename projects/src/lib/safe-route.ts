import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { classifyError } from "@/lib/reliability-types";

function getRequestId(request: Request | NextRequest): string {
  try {
    return (request as Request & { headers: Headers }).headers.get("x-request-id") ?? "";
  } catch {
    return "";
  }
}

function generateFallbackRequestId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `vx-${ts}-${rand}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (request: any, ...args: any[]) => Promise<NextResponse | Response>;

export function safeRoute(handler: RouteHandler): RouteHandler {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (request: any, ...args: any[]): Promise<NextResponse | Response> => {
    const requestId = getRequestId(request) || generateFallbackRequestId();
    const start = Date.now();

    try {
      const response = await handler(request, ...args);
      try {
        response.headers.set("x-request-id", requestId);
        response.headers.set("x-response-time-ms", String(Date.now() - start));
      } catch {
        // header setting is best-effort
      }
      return response;
    } catch (err) {
      const classified = classifyError(err);
      const durationMs = Date.now() - start;

      console.error("[vrixo.safe-route]", JSON.stringify({
        level: "error",
        message: "route_handler_caught",
        requestId,
        error: classified.message,
        errorType: classified.type,
        recoverable: classified.recoverable,
        durationMs,
        ts: new Date().toISOString(),
      }));

      if (classified.recoverable) {
        return NextResponse.json(
          {
            error: "Service temporarily unavailable. Please try again.",
            requestId,
            retryAfter: 5,
          },
          {
            status: 503,
            headers: {
              "x-request-id": requestId,
              "Retry-After": "5",
              "Cache-Control": "no-store",
            },
          }
        );
      }

      return NextResponse.json(
        {
          error: "An unexpected error occurred.",
          requestId,
        },
        {
          status: 500,
          headers: {
            "x-request-id": requestId,
            "Cache-Control": "no-store",
          },
        }
      );
    }
  };
}
