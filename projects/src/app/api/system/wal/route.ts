import { NextResponse } from "next/server";
import { recoverOrphanedWalEntries } from "@/lib/write-ahead-log";
import { requireOwnerAdminApi } from "@/lib/require-admin";

export async function POST(request: Request) {
  try {
    const auth = await requireOwnerAdminApi(request);
    if (!auth.ok) return auth.response;

    const recovered = await recoverOrphanedWalEntries();
    return NextResponse.json({ recovered, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
