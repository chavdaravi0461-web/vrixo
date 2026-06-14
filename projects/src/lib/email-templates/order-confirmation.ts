type OrderConfirmationEmailInput = {
  customerName: string;
  orderNumber: string;
  items: Array<Record<string, unknown>>;
  total: number;
  paymentMethod: string;
  shippingAddress: unknown;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(amount)));
}

function formatAddress(addr: unknown): string {
  if (!addr || typeof addr !== "object") return "Address saved with your order";
  const a = addr as Record<string, unknown>;
  return [a.line1, a.line2, a.city, a.state, a.postalCode, a.country]
    .map((p) => (p ? String(p).trim() : ""))
    .filter(Boolean)
    .join(", ") || "Address saved with your order";
}

export function buildOrderConfirmationEmailHtml(input: OrderConfirmationEmailInput): string {
  const items = input.items || [];
  const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const itemNames = items.map((item) => String(item.title || "")).filter(Boolean).join(", ") || "Your items";

  const itemRows = items.map((item) => {
    const title = String(item.title || "Item");
    const qty = Number(item.quantity) || 1;
    const price = Number(item.price) || 0;
    const image = String(item.image || "");
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              ${image ? `<td width="64" style="padding-right:12px;"><img src="${image}" width="64" height="64" style="border-radius:8px;object-fit:cover;" alt="" /></td>` : ""}
              <td style="vertical-align:top;">
                <div style="font-size:14px;font-weight:600;color:#1a1a1a;">${title}</div>
                <div style="font-size:12px;color:#666;margin-top:4px;">Qty: ${qty}</div>
              </td>
              <td style="vertical-align:top;text-align:right;">
                <div style="font-size:14px;font-weight:600;color:#1a1a1a;">${formatCurrency(price * qty)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0a0a0a,#1a1a2e);padding:32px 40px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:0.05em;">VRIXO</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:4px;text-transform:uppercase;letter-spacing:0.12em;">Luxury Redefined</div>
        </td></tr>

        <!-- Success Badge -->
        <tr><td style="padding:32px 40px 0;text-align:center;">
          <div style="width:64px;height:64px;border-radius:50%;background:#e8f5e9;margin:0 auto 16px;">
            <div style="width:64px;height:64px;line-height:64px;font-size:28px;text-align:center;">&#10003;</div>
          </div>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#1a1a1a;">Order Confirmed!</h1>
          <p style="margin:8px 0 0;font-size:14px;color:#666;">Thank you for your purchase, ${input.customerName}.</p>
        </td></tr>

        <!-- Order Info -->
        <tr><td style="padding:24px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:16px 20px;border-bottom:1px solid #eee;">
                <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.06em;">Order Number</div>
                <div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-top:4px;font-family:monospace;">${input.orderNumber}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px;border-bottom:1px solid #eee;">
                <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.06em;">Payment Method</div>
                <div style="font-size:14px;font-weight:600;color:#1a1a1a;margin-top:4px;">${input.paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment"}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px;">
                <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.06em;">Delivery Address</div>
                <div style="font-size:13px;color:#444;margin-top:4px;line-height:1.5;">${formatAddress(input.shippingAddress)}</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Items -->
        <tr><td style="padding:0 40px;">
          <div style="font-size:12px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Items Ordered (${itemCount})</div>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${itemRows}
          </table>
        </td></tr>

        <!-- Total -->
        <tr><td style="padding:20px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:16px 20px;background:#0a0a0a;border-radius:12px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td><span style="font-size:13px;color:rgba(255,255,255,0.6);">Total Amount</span></td>
                    <td style="text-align:right;"><span style="font-size:20px;font-weight:800;color:#ffffff;">${formatCurrency(input.total)}</span></td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Next Steps -->
        <tr><td style="padding:0 40px 32px;">
          <div style="background:#f0f4ff;border-radius:12px;padding:20px;">
            <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:8px;">What happens next?</div>
            <div style="font-size:12px;color:#555;line-height:1.7;">
              1. We'll review and process your order<br>
              2. You'll receive a shipping notification<br>
              3. Estimated delivery: 3-5 business days
            </div>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9f9f9;padding:24px 40px;text-align:center;border-top:1px solid #eee;">
          <div style="font-size:11px;color:#999;line-height:1.6;">
            If you have any questions, contact us at <a href="mailto:support@vrixo.in" style="color:#6366f1;">support@vrixo.in</a><br>
            &copy; ${new Date().getFullYear()} Vrixo. All rights reserved.
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
