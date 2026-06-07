import { NextResponse } from "next/server";
import { inventoryGrid } from "@/services/inventory/inventory-grid";
import { requireOwnerAdminApi } from "@/lib/require-admin";

export async function GET(request: Request) {
  try {
    const auth = await requireOwnerAdminApi(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    const lowStock = url.searchParams.get("lowStock") === "true";
    const threshold = Number(url.searchParams.get("threshold") ?? 5);

    if (lowStock) {
      const products = await inventoryGrid.getLowStockProducts(threshold);
      return NextResponse.json({ lowStockProducts: products });
    }

    if (productId) {
      const inventory = await inventoryGrid.getProductInventory(productId);
      if (!inventory) return NextResponse.json({ error: "Product not found" }, { status: 404 });
      return NextResponse.json(inventory);
    }

    return NextResponse.json({ error: "productId or lowStock=true required" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireOwnerAdminApi(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const action = String(body.action ?? "");

    if (action === "recover-reservations") {
      const recovered = await inventoryGrid.recoverExpiredReservations();
      return NextResponse.json({ recovered });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
