type WhatsAppLogContext = Record<string, unknown>;

/** Server-only WhatsApp logs — never log tokens or full phone numbers. */
export function whatsappLog(
  level: "info" | "warn" | "error",
  message: string,
  context: WhatsAppLogContext = {}
) {
  const safeContext = sanitizeLogContext(context);
  const payload = {
    area: "whatsapp",
    message,
    ...safeContext,
    ts: new Date().toISOString()
  };

  if (level === "error") {
    console.error("[whatsapp]", JSON.stringify(payload));
    return;
  }

  if (level === "warn") {
    console.warn("[whatsapp]", JSON.stringify(payload));
    return;
  }

  console.info("[whatsapp]", JSON.stringify(payload));
}

function sanitizeLogContext(context: WhatsAppLogContext) {
  const next: WhatsAppLogContext = { ...context };

  for (const key of Object.keys(next)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("token") ||
      lower.includes("secret") ||
      lower.includes("password") ||
      lower.includes("authorization")
    ) {
      next[key] = "[redacted]";
    }
  }

  if (typeof next.phone === "string") {
    next.phone = maskPhone(next.phone);
  }

  if (typeof next.customerPhone === "string") {
    next.customerPhone = maskPhone(next.customerPhone);
  }

  return next;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}
