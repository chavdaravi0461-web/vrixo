import { describe, it, expect } from "vitest";

describe("Pipeline Survival", () => {
  it("NullSupabaseClient should survive all query methods", async () => {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const client = createAdminClient();

    const { data: selectData, error: selectError } = await client.from("orders").select("*");
    expect(selectData).toBeNull();
    expect(selectError).toBeNull();

    const { data: insertData, error: insertError } = await client.from("orders").insert({});
    expect(insertData).toBeNull();
    expect(insertError).toBeNull();

    const { data: updateData, error: updateError } = await client.from("orders").update({}).eq("id", "x");
    expect(updateData).toBeNull();
    expect(updateError).toBeNull();

    const { data: deleteData, error: deleteError } = await client.from("orders").delete().eq("id", "x");
    expect(deleteData).toBeNull();
    expect(deleteError).toBeNull();
  });

  it("NullSupabaseClient should survive chained queries", async () => {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const client = createAdminClient();

    const { data } = await client
      .from("orders")
      .select("id, status, total")
      .eq("status", "pending")
      .neq("total", 0)
      .like("customer_name", "%test%")
      .ilike("customer_email", "%@%")
      .order("created_at", { ascending: false })
      .limit(10)
      .maybeSingle();

    expect(data).toBeNull();
  });

  it("safeRoute should survive non-NextResponse returns", async () => {
    const { safeRoute } = await import("@/lib/safe-route");
    const handler = safeRoute(async () => {
      const { NextResponse } = await import("next/server");
      return NextResponse.json({ success: true });
    });
    const response = await handler(new Request("http://localhost/test"));
    expect(response.status).toBe(200);
  });
});
