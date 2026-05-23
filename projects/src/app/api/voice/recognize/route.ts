import { NextResponse } from "next/server";
import os from "node:os";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const audioBase64 = String(body.audio ?? "");

  if (!audioBase64) return NextResponse.json({ message: "audio required" }, { status: 400 });

  try {
    // attempt to transcribe using OpenAI if available
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // create buffer
    const buffer = Buffer.from(audioBase64, "base64");
    // write to temp file and call OpenAI speech-to-text if method exists, else fallback to simple error
    const fs = await import("fs/promises");
    const tmp = path.join(os.tmpdir(), `vrixo_voice_${Date.now()}.ogg`);
    await fs.writeFile(tmp, buffer);
    let transcript = "";
    try {
      // SDK may provide audio.transcriptions.create or speech.transcriptions
      // Try both patterns
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

    // do a simple product search by title keywords
    const supabase = createAdminClient();
    const keywords = transcript.split(/\s+/).slice(0, 6).join(" ");
    const { data: products } = await supabase.from("products").select("id, title, price, images, slug").ilike("title", `%${keywords}%`).limit(8);

    return NextResponse.json({ transcript, products: products ?? [] });
  } catch (err) {
    return NextResponse.json({ message: "failed", error: String(err) }, { status: 500 });
  }
}
