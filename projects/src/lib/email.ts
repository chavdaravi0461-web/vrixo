import { Resend } from "resend";
import { getOptionalServerEnv } from "@/lib/env/server";
import { logInfo, logError } from "@/lib/observability";

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (resendClient) return resendClient;
  const env = getOptionalServerEnv();
  if (!env.RESEND_API_KEY) return null;
  resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
}

export function hasEmailEnv(): boolean {
  return Boolean(getOptionalServerEnv().RESEND_API_KEY);
}

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

export async function sendEmail({ to, subject, html, from }: SendEmailParams): Promise<{ sent: boolean; error: string | null }> {
  const client = getResendClient();
  const env = getOptionalServerEnv();

  if (!client) {
    logError("email.send.skip", { reason: "no_resend_client" });
    return { sent: false, error: "Email service not configured." };
  }

  try {
    const { data, error } = await client.emails.send({
      from: from || env.RESEND_FROM_EMAIL || "Vrixo <notifications@vrixo.in>",
      to: [to],
      subject,
      html
    });

    if (error) {
      logError("email.send.failed", { to: to.slice(0, 3) + "***", error: error.message });
      return { sent: false, error: error.message };
    }

    logInfo("email.send.success", { to: to.slice(0, 3) + "***", id: data?.id });
    return { sent: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown email error";
    logError("email.send.exception", { error: msg });
    return { sent: false, error: msg };
  }
}
