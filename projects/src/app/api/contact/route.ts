import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/api-response";
import { contactSchema } from "@/lib/validations";
import { safeRoute } from "@/lib/safe-route";

const contactUsSchema = z.object({
  name: z.string().trim().min(2, "Name is required."),
  contact: z.string().trim().min(5, "Email or mobile number is required."),
  subject: z.string().trim().min(3, "Subject is required."),
  message: z.string().trim().min(10, "Message is required.")
});

export const POST = safeRoute(async function POST(request: Request) {
  const rateLimit = await checkServerRateLimit(request, { key: "contact", limit: 5, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) return tooManyRequests(rateLimit.retryAfter);

  const body = await request.json().catch(() => null);
  const parsed = parseContactPayload(body);

  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const messagePayload = {
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    subject: parsed.data.subject,
    message: parsed.data.message
  };

  const { error } = await supabase.from("contact_messages").insert(messagePayload);

  if (error) {
    console.error("CONTACT_SUBMIT_ERROR", error);
    return NextResponse.json({ message: "Message could not be sent. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ message: "Message sent successfully." });
});

function parseContactPayload(body: unknown):
  | {
      ok: true;
      data: {
        name: string;
        email: string;
        phone: string;
        subject: string;
        message: string;
      };
    }
  | { ok: false; message: string } {
  const legacy = contactSchema.safeParse(body);
  if (legacy.success) {
    return { ok: true, data: legacy.data };
  }

  const contactUs = contactUsSchema.safeParse(body);
  if (!contactUs.success) {
    return {
      ok: false,
      message: legacy.error.issues[0]?.message ?? contactUs.error.issues[0]?.message ?? "Invalid contact details."
    };
  }

  const contact = contactUs.data.contact;
  const email = z.email().safeParse(contact).success ? contact : "not-provided@vrixo.in";
  const phone = email === contact ? "Not provided" : contact;

  return {
    ok: true,
    data: {
      name: contactUs.data.name,
      email,
      phone,
      subject: contactUs.data.subject,
      message: contactUs.data.message
    }
  };
}
