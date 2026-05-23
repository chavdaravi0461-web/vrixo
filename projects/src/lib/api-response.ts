import { NextResponse } from "next/server";

export function badRequest(message = "Invalid request") {
  return NextResponse.json({ message }, { status: 400 });
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ message }, { status: 401 });
}

export function forbidden(message = "Access denied") {
  return NextResponse.json({ message }, { status: 403 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ message }, { status: 404 });
}

export function conflict(message = "Request conflict") {
  return NextResponse.json({ message }, { status: 409 });
}

export function tooManyRequests(retryAfter?: number) {
  return NextResponse.json(
    { message: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined
    }
  );
}

export function serverError(message = "Unable to process request. Please try again.") {
  return NextResponse.json({ message }, { status: 500 });
}
