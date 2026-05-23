import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: "OTP login disabled. Please use password login.",
    },
    { status: 410 }
  );
}