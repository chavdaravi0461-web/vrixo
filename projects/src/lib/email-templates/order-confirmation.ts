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

  const itemRows = items.map((item) => {
    const title = String(item.title || "Item");
    const qty = Number(item.quantity) || 1;
    const price = Number(item.price) || 0;
    const image = String(item.image || "");
    const isLast = items.indexOf(item) === items.length - 1;
    return `
      <tr>
        <td style="padding:20px 0 ${isLast ? '0' : '0'};border-bottom:${isLast ? 'none' : '1px solid rgba(255,255,255,0.06)'};">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              ${image ? `<td width="72" style="padding-right:16px;vertical-align:middle;">
                <img src="${image}" width="72" height="72" style="border-radius:12px;object-fit:cover;display:block;" alt="" />
              </td>` : ''}
              <td style="vertical-align:middle;">
                <div style="font-size:15px;font-weight:600;color:#ffffff;letter-spacing:0.01em;">${title}</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:6px;letter-spacing:0.02em;">Qty: ${qty}</div>
              </td>
              <td style="vertical-align:middle;text-align:right;">
                <div style="font-size:15px;font-weight:600;color:#ffffff;font-variant-numeric:tabular-nums;">${formatCurrency(price * qty)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join('');

  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Order Confirmed — VRIXO</title>
  <!--[if mso]>
  <noscript><xml>
    <o:OfficeDocumentSettings>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml></noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 0; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; padding: 16px !important; }
      .responsive-pad { padding-left: 24px !important; padding-right: 24px !important; }
      .hero-pad { padding: 40px 24px !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
      .mobile-center { text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Preheader (hidden) -->
  <div style="display:none;font-size:1px;color:#0a0a0a;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Your order ${input.orderNumber} is confirmed. We're preparing your items for dispatch.
  </div>

  <!-- Outer wrapper — deep black -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Email Container -->
        <table role="presentation" class="email-container" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#111111;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.05);">

          <!-- ═══════════════════════════════════════════ -->
          <!-- HERO SECTION — Ultra premium black + gold  -->
          <!-- ═══════════════════════════════════════════ -->
          <tr>
            <td class="hero-pad" style="padding:52px 48px 44px;text-align:center;background:linear-gradient(165deg,#0a0a0a 0%,#111111 40%,#161618 100%);position:relative;">

              <!-- Gold accent line -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 0;">
                <tr>
                  <td style="width:40px;height:1px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);"></td>
                </tr>
              </table>

              <!-- Brand Mark -->
              <div style="margin:20px 0 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr>
                    <td style="padding:0 12px;">
                      <span style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:0.18em;font-family:'Inter',sans-serif;">VRIXO</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Tagline -->
              <div style="margin-top:8px;">
                <span style="font-size:9px;color:rgba(201,168,76,0.7);letter-spacing:0.35em;text-transform:uppercase;font-weight:500;">LUXURY REDEFINED</span>
              </div>

              <!-- Gold divider -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
                <tr>
                  <td style="width:60px;height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.3),transparent);"></td>
                </tr>
              </table>

              <!-- Checkmark Circle -->
              <div style="margin:28px auto 0;width:72px;height:72px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr>
                    <td style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,rgba(201,168,76,0.15),rgba(201,168,76,0.05));border:1px solid rgba(201,168,76,0.25);text-align:center;vertical-align:middle;">
                      <span style="font-size:28px;line-height:72px;color:#c9a84c;">&#10003;</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Headline -->
              <h1 style="margin:24px 0 0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;line-height:1.2;">
                Order Confirmed
              </h1>

              <!-- Subheadline -->
              <p style="margin:12px 0 0;font-size:14px;color:rgba(255,255,255,0.5);font-weight:400;line-height:1.5;">
                Thank you, ${input.customerName}. Your order has been received<br>and is being prepared with care.
              </p>

            </td>
          </tr>

          <!-- ═══════════════════════════════════════════ -->
          <!-- ORDER DETAILS — Minimal card               -->
          <!-- ═══════════════════════════════════════════ -->
          <tr>
            <td class="responsive-pad" style="padding:0 36px;">

              <!-- Order info card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">

                <!-- Order Number -->
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <div style="font-size:10px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.12em;font-weight:600;">Order Number</div>
                          <div style="margin-top:6px;font-size:16px;font-weight:700;color:#c9a84c;letter-spacing:0.06em;font-variant-numeric:tabular-nums;">${input.orderNumber}</div>
                        </td>
                        <td style="text-align:right;vertical-align:top;">
                          <div style="font-size:10px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.12em;font-weight:600;">Payment</div>
                          <div style="margin-top:6px;font-size:13px;font-weight:500;color:rgba(255,255,255,0.7);">${input.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Delivery Address -->
                <tr>
                  <td style="padding:20px 24px;">
                    <div style="font-size:10px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.12em;font-weight:600;">Delivery Address</div>
                    <div style="margin-top:6px;font-size:13px;color:rgba(255,255,255,0.6);line-height:1.6;">${formatAddress(input.shippingAddress)}</div>
                  </td>
                </tr>

              </table>

            </td>
          </tr>

          <!-- ═══════════════════════════════════════════ -->
          <!-- ITEMS SECTION                              -->
          <!-- ═══════════════════════════════════════════ -->
          <tr>
            <td class="responsive-pad" style="padding:32px 36px 0;">

              <!-- Section header -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.08);">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="font-size:10px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.12em;font-weight:600;">Items Ordered</span>
                        </td>
                        <td style="text-align:right;">
                          <span style="font-size:11px;color:rgba(255,255,255,0.3);font-weight:500;">${itemCount} ${itemCount === 1 ? 'item' : 'items'}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Items list -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${itemRows}
              </table>

            </td>
          </tr>

          <!-- ═══════════════════════════════════════════ -->
          <!-- TOTAL SECTION — Premium dark bar            -->
          <!-- ═══════════════════════════════════════════ -->
          <tr>
            <td class="responsive-pad" style="padding:32px 36px 0;">

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:24px 28px;background:linear-gradient(135deg,#0d0d0d,#141414);border:1px solid rgba(201,168,76,0.12);border-radius:14px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Total Amount</span>
                        </td>
                        <td style="text-align:right;">
                          <span style="font-size:24px;font-weight:800;color:#c9a84c;letter-spacing:-0.01em;font-variant-numeric:tabular-nums;">${formatCurrency(input.total)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ═══════════════════════════════════════════ -->
          <!-- WHAT'S NEXT — Elegant steps                 -->
          <!-- ═══════════════════════════════════════════ -->
          <tr>
            <td class="responsive-pad" style="padding:32px 36px 0;">

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(201,168,76,0.04);border:1px solid rgba(201,168,76,0.1);border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:24px 28px;">

                    <div style="font-size:10px;color:rgba(201,168,76,0.6);text-transform:uppercase;letter-spacing:0.12em;font-weight:700;margin-bottom:16px;">What Happens Next</div>

                    <!-- Step 1 -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                      <tr>
                        <td width="28" style="vertical-align:top;padding-top:1px;">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:22px;height:22px;border-radius:50%;background:rgba(201,168,76,0.12);text-align:center;vertical-align:middle;">
                                <span style="font-size:10px;font-weight:700;color:#c9a84c;line-height:22px;">1</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td style="padding-left:12px;">
                          <div style="font-size:13px;color:rgba(255,255,255,0.7);font-weight:500;">Order Processing</div>
                          <div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:2px;">We'll verify and prepare your items</div>
                        </td>
                      </tr>
                    </table>

                    <!-- Step 2 -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                      <tr>
                        <td width="28" style="vertical-align:top;padding-top:1px;">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:22px;height:22px;border-radius:50%;background:rgba(201,168,76,0.12);text-align:center;vertical-align:middle;">
                                <span style="font-size:10px;font-weight:700;color:#c9a84c;line-height:22px;">2</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td style="padding-left:12px;">
                          <div style="font-size:13px;color:rgba(255,255,255,0.7);font-weight:500;">Shipping Notification</div>
                          <div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:2px;">You'll receive tracking details via email</div>
                        </td>
                      </tr>
                    </table>

                    <!-- Step 3 -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="28" style="vertical-align:top;padding-top:1px;">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:22px;height:22px;border-radius:50%;background:rgba(201,168,76,0.12);text-align:center;vertical-align:middle;">
                                <span style="font-size:10px;font-weight:700;color:#c9a84c;line-height:22px;">3</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td style="padding-left:12px;">
                          <div style="font-size:13px;color:rgba(255,255,255,0.7);font-weight:500;">Delivery</div>
                          <div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:2px;">Estimated arrival in 3–5 business days</div>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ═══════════════════════════════════════════ -->
          <!-- CTA BUTTON — Gold gradient                  -->
          <!-- ═══════════════════════════════════════════ -->
          <tr>
            <td class="responsive-pad" style="padding:32px 36px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:linear-gradient(135deg,#c9a84c,#b8942e);border-radius:10px;">
                          <a href="https://vrixo.in/my-orders" target="_blank" style="display:inline-block;padding:14px 36px;font-size:13px;font-weight:700;color:#0a0a0a;text-decoration:none;letter-spacing:0.04em;">Track Your Order</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ═══════════════════════════════════════════ -->
          <!-- SPACER                                      -->
          <!-- ═══════════════════════════════════════════ -->
          <tr><td style="padding:36px 0 0;"></td></tr>

          <!-- ═══════════════════════════════════════════ -->
          <!-- FOOTER — Minimal, premium                   -->
          <!-- ═══════════════════════════════════════════ -->
          <tr>
            <td style="background:linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.04));border-top:1px solid rgba(255,255,255,0.06);padding:32px 36px;text-align:center;">

              <!-- Brand name -->
              <div style="font-size:16px;font-weight:700;color:#ffffff;letter-spacing:0.12em;">VRIXO</div>

              <!-- Tagline -->
              <div style="margin-top:4px;font-size:9px;color:rgba(255,255,255,0.3);letter-spacing:0.3em;text-transform:uppercase;">Luxury Redefined</div>

              <!-- Divider -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto;">
                <tr>
                  <td style="width:40px;height:1px;background:rgba(255,255,255,0.1);"></td>
                </tr>
              </table>

              <!-- Support -->
              <div style="font-size:12px;color:rgba(255,255,255,0.35);line-height:1.6;">
                Need help? Contact us at<br>
                <a href="mailto:support@vrixo.in" style="color:#c9a84c;text-decoration:none;font-weight:500;">support@vrixo.in</a>
              </div>

              <!-- Social Links -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto 0;">
                <tr>
                  <td style="padding:0 8px;">
                    <a href="https://instagram.com/vrixo.in" target="_blank" style="text-decoration:none;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.06);text-align:center;vertical-align:middle;">
                            <span style="font-size:12px;color:rgba(255,255,255,0.4);">IG</span>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                  <td style="padding:0 8px;">
                    <a href="https://twitter.com/vrixo_in" target="_blank" style="text-decoration:none;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.06);text-align:center;vertical-align:middle;">
                            <span style="font-size:12px;color:rgba(255,255,255,0.4);">X</span>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                  <td style="padding:0 8px;">
                    <a href="https://vrixo.in" target="_blank" style="text-decoration:none;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.06);text-align:center;vertical-align:middle;">
                            <span style="font-size:12px;color:rgba(255,255,255,0.4);">W</span>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Legal -->
              <div style="margin-top:20px;font-size:10px;color:rgba(255,255,255,0.2);line-height:1.6;">
                &copy; ${currentYear} Vrixo. All rights reserved.<br>
                <a href="https://vrixo.in/privacy-policy" style="color:rgba(255,255,255,0.3);text-decoration:underline;">Privacy Policy</a>
                &nbsp;&middot;&nbsp;
                <a href="https://vrixo.in/terms-and-conditions" style="color:rgba(255,255,255,0.3);text-decoration:underline;">Terms</a>
              </div>

            </td>
          </tr>

        </table>
        <!-- /Email Container -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}
