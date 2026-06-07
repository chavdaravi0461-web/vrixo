import "server-only";
import { runWithTrace, extractTraceFromHeaders, traceHeaders, addTraceBaggage } from "@/lib/trace-context";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function withTraceMiddleware(request: NextRequest): Promise<Response | undefined> {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/")) {
    const headers = request.headers;
    const trace = extractTraceFromHeaders(headers as unknown as Record<string, string>, "api-gateway");

    addTraceBaggage("path", path);
    addTraceBaggage("method", request.method);

    return undefined;
  }
  return undefined;
}

export function tracedHandler(
  origin: string,
  service: string,
  handler: (request: Request) => Promise<NextResponse>,
  fallback?: () => NextResponse,
) {
  return async function traced(request: Request): Promise<Response> {
    return runWithTrace(origin, service, async () => {
      try {
        const response = await handler(request);
        const trace = traceHeaders();
        for (const [key, value] of Object.entries(trace)) {
          if (value) response.headers.set(key, value);
        }
        return response;
      } catch (error) {
        if (fallback) return fallback();
        return NextResponse.json(
          { error: "Internal server error", code: "TRACE_ERROR" },
          { status: 500 },
        );
      }
    });
  };
}
