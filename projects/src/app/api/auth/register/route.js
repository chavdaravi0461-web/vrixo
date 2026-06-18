import { NextResponse } from "next/server";

export async function POST(request) {
  // Legacy Firebase register route — disabled. Use /api/auth/password-signup instead.
  return NextResponse.json(
    { error: "This registration method is no longer available. Please use the signup page." },
    { status: 410 }
  );
}
