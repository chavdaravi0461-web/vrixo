import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      message:
        "Coupons are applied by the secure checkout routes and marked used after COD order placement or verified online payment."
    },
    { status: 200 }
  );
}
