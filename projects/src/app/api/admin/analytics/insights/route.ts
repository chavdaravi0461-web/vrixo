import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();
  try {
    const { data: revenueRows } = await supabase.from("orders").select("total, created_at").order("created_at", { ascending: false }).limit(200);
    const revenue = (revenueRows ?? []).reduce((s: number, r: any) => s + Number(r.total ?? 0), 0);

    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `Provide concise business insights for an ecommerce brand with total recent revenue ₹${revenue}. Suggest 5 growth actions and 3 retention strategies.`;
    const resp = await client.chat.completions.create({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: 300 });
    const insights = resp.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({ revenue, insights });
  } catch (err) {
    return NextResponse.json({ message: "failed", error: String(err) }, { status: 500 });
  }
}
