import { NextResponse } from "next/server";
import { circuitMesh } from "@/lib/circuit-mesh";
import { requireOwnerAdminApi } from "@/lib/require-admin";

export async function GET(request: Request) {
  try {
    const auth = await requireOwnerAdminApi(request);
    if (!auth.ok) return auth.response;

    return NextResponse.json(circuitMesh.getMeshStatus());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
