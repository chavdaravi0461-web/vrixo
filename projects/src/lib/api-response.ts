import { NextResponse } from "next/server";
import { generateRequestId } from "@/lib/observability";

export type ApiErrorResponse = {
  success: false;
  message: string;
  code?: string;
  requestId?: string;
  details?: unknown;
};

export type ApiSuccessResponse<T = unknown> = {
  success: true;
  data: T;
  requestId?: string;
};

function getRequestId(request?: Request): string | undefined {
  return request?.headers.get("x-request-id") ?? undefined;
}

export function badRequest(message = "Invalid request", code?: string, request?: Request) {
  return NextResponse.json<ApiErrorResponse>(
    { success: false, message, code, requestId: getRequestId(request) },
    { status: 400 }
  );
}

export function unauthorized(message = "Unauthorized", request?: Request) {
  return NextResponse.json<ApiErrorResponse>(
    { success: false, message, requestId: getRequestId(request) },
    { status: 401 }
  );
}

export function forbidden(message = "Access denied", request?: Request) {
  return NextResponse.json<ApiErrorResponse>(
    { success: false, message, requestId: getRequestId(request) },
    { status: 403 }
  );
}

export function notFound(message = "Not found", request?: Request) {
  return NextResponse.json<ApiErrorResponse>(
    { success: false, message, requestId: getRequestId(request) },
    { status: 404 }
  );
}

export function conflict(message = "Request conflict", code?: string, request?: Request) {
  return NextResponse.json<ApiErrorResponse>(
    { success: false, message, code, requestId: getRequestId(request) },
    { status: 409 }
  );
}

export function tooManyRequests(retryAfter?: number, request?: Request) {
  return NextResponse.json<ApiErrorResponse>(
    {
      success: false,
      message: "Too many requests. Please try again later.",
      requestId: getRequestId(request)
    },
    {
      status: 429,
      headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined
    }
  );
}

export function serverError(
  message = "Unable to process request. Please try again.",
  code?: string,
  request?: Request
) {
  const requestId = getRequestId(request) || generateRequestId();
  console.error("[api.500]", { requestId, message, code });
  return NextResponse.json<ApiErrorResponse>(
    { success: false, message, code, requestId },
    { status: 500 }
  );
}

export function success<T>(data: T, status = 200, request?: Request) {
  return NextResponse.json<ApiSuccessResponse<T>>(
    { success: true, data, requestId: getRequestId(request) },
    { status }
  );
}
