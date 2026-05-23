import { NextResponse } from "next/server";
import { connectMongo, WhatsAppAttempt } from "@/lib/mongo/models";

export async function GET(request: Request) {
  const key = request.headers.get("x-admin-key") || request.headers.get("x-server-key");
  const secret = process.env.ADMIN_API_KEY || process.env.WHATSAPP_ADMIN_SECRET;

  if (!secret || key !== secret) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectMongo();
    const rows = await WhatsAppAttempt.find({}).sort({ createdAt: -1 }).limit(200).lean();
    return NextResponse.json({ data: rows });
  } catch (err) {
    return NextResponse.json({ message: "Failed to fetch logs", error: String(err) }, { status: 500 });
  }
}
