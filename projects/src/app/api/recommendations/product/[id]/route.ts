import { NextResponse } from "next/server";
import { recommendSimilar } from "@/services/recommendations/recommendations";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const list = await recommendSimilar(id);
    return NextResponse.json({ data: list });
  } catch (err) {
    return NextResponse.json({ message: "failed", error: String(err) }, { status: 500 });
  }
}
