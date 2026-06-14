export function buildPasswordResetEmailHtml({
  resetUrl,
  customerName
}: {
  resetUrl: string;
  customerName?: string;
}): string {
  const greeting = customerName ? `Hi ${customerName}` : "Hi there";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Vrixo Password</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111118;border:1px solid rgba(99,102,241,0.15);border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:40px 40px 0;text-align:center;">
              <div style="width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px;">
                <span style="color:#fff;font-size:24px;font-weight:800;letter-spacing:-1px;">V</span>
              </div>
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#f1f5f9;letter-spacing:-0.03em;">Reset your password</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.6;">${greeting},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.6;">
                We received a request to reset the password for your <strong style="color:#e2e8f0;">Vrixo</strong> account. Click the button below to set a new password.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:-0.01em;">
                      Set new password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.6;">
                This link expires in <strong style="color:#94a3b8;">1 hour</strong>.
              </p>
              <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
                If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 40px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top:1px solid rgba(99,102,241,0.1);padding-top:24px;text-align:center;">
                    <p style="margin:0 0 8px;font-size:12px;color:#475569;">Vrixo — Commerce Operating System</p>
                    <p style="margin:0;font-size:11px;color:#334155;">
                      This is a transactional email regarding your account security.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildPasswordResetWhatsAppMessage({
  resetUrl,
  customerName
}: {
  resetUrl: string;
  customerName?: string;
}): string {
  const greeting = customerName ? `Hi ${customerName}` : "Hi there";

  return `${greeting},

🔐 *Vrixo — Password Reset*

We received a request to reset your Vrixo account password.

Tap the link below to set a new password:
${resetUrl}

This link expires in 1 hour.

If you didn't request this, ignore this message. Your password will remain unchanged.

— Team Vrixo`;
}
