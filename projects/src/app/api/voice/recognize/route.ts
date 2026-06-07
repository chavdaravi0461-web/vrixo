import { NextResponse } from "next/server";
import os from "node:os";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth";
import { safeRoute } from "@/lib/safe-route";

export const POST = safeRoute(async function POST(request: Request) {
  const limited = await checkServerRateLimit(request, { key: "voice-recognize", limit: 10, windowMs: 60 * 1000 });
  if (!limited.allowed) {
    return NextResponse.json({ message: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const audioBase64 = String(body.audio ?? "");

  if (!audioBase64) return NextResponse.json({ message: "audio required" }, { status: 400 });

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const buffer = Buffer.from(audioBase64, "base64");
    const fs = await import("fs/promises");
    const tmp = path.join(os.tmpdir(), `vrixo_voice_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.ogg`);
    await fs.writeFile(tmp, buffer);
    let transcript = "";
    try {
      if ((client as any).speech && (client as any).speech.transcriptions) {
        const res = await (client as any).speech.transcriptions.create({ file: tmp, model: process.env.OPENAI_MODEL || "gpt-4o-mini" });
        transcript = res.text || res?.data?.[0]?.text || "";
      } else if ((client as any).audio && (client as any).audio.transcriptions) {
        const res = await (client as any).audio.transcriptions.create({ file: tmp, model: process.env.OPENAI_MODEL || "gpt-4o-mini" });
        transcript = res.text || res?.data?.[0]?.text || "";
      } else {
        transcript = "";
      }
    } catch {
      transcript = "";
    } finally {
      try { await fs.unlink(tmp); } catch {}
    }

    if (!transcript) return NextResponse.json({ message: "transcription unavailable" }, { status: 502 });

    const supabase = createAdminClient();
    const keywords = transcript.split(/\s+/).slice(0, 6).join(" ");
    const { data: products } = await supabase.from("products").select("id, title, price, images, slug").ilike("title", `%${keywords}%`).limit(8);

    return NextResponse.json({ transcript, products: products ?? [] });
  } catch (err) {
    return NextResponse.json({ message: "failed", error: String(err) }, { status: 500 });
  }
});
