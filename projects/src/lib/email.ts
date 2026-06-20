import nodemailer from "nodemailer";
import { logInfo, logError } from "@/lib/observability";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com";
  const port = Number(process.env.BREVO_SMTP_PORT || 587);
  const user = process.env.BREVO_SMTP_LOGIN;
  const pass = process.env.BREVO_SMTP_KEY;

  if (!user || !pass) return null;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

export function hasEmailEnv(): boolean {
  return Boolean(process.env.BREVO_SMTP_LOGIN && process.env.BREVO_SMTP_KEY);
}

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

export async function sendEmail({ to, subject, html, from }: SendEmailParams): Promise<{ sent: boolean; error: string | null }> {
  const transport = getTransporter();

  if (!transport) {
    logError("email.send.skip", { reason: "no_smtp_transport" });
    return { sent: false, error: "Email service not configured." };
  }

  try {
    const senderEmail = process.env.BREVO_SENDER_EMAIL || "chavdaravi0461@gmail.com";
    const senderName = process.env.BREVO_SENDER_NAME || "Vrixo";
    const fromAddress = from || `${senderName} <${senderEmail}>`;

    const info = await transport.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
    });

    logInfo("email.send.success", { to: to.slice(0, 3) + "***", id: info.messageId });
    return { sent: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown email error";
    logError("email.send.exception", { error: msg });
    return { sent: false, error: msg };
  }
}
