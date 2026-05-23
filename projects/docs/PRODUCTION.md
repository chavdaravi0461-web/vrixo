# VRIXO Production Guide

## Required environment variables (Vercel)

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | Canonical site URL (`https://www.vrixo.in`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server order lookup + admin writes |
| `CHECKOUT_TOKEN_SECRET` | Yes (32+ chars) | Secure Razorpay verification |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | For online pay | Razorpay public key |
| `RAZORPAY_KEY_ID` | For online pay | Razorpay server key |
| `RAZORPAY_KEY_SECRET` | For online pay | Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | Recommended | Webhook signature validation |
| `WHATSAPP_CLOUD_API_TOKEN` | For WhatsApp | Meta Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | For WhatsApp | WhatsApp phone number ID |
| `WHATSAPP_ADMIN_NUMBER` | Recommended | Admin alert number |
| `OPENAI_API_KEY` | For AI widget | Web support chat |
| `OPENAI_MODEL` | Optional | Defaults to `gpt-4o-mini` |

## Core customer routes

- `/checkout` – authenticated checkout
- `/order-success/[orderNumber]` – post-checkout confirmation
- `/order/track/[orderNumber]` – order tracking
- `/api/orders/[orderNumber]` – authenticated order lookup
- `/api/orders/[orderNumber]/whatsapp` – resend WhatsApp confirmation
- `/api/support/chat` – AI support widget backend

## Deployment (Vercel)

1. Connect repository root to `projects/` if monorepo, or deploy `projects` as project root.
2. Set all required environment variables in Vercel → Settings → Environment Variables.
3. Run `npm run build` locally before deploy.
4. Deploy to production and verify:
   - `/order-success/DC-TEST123-ABCDEF` pattern resolves (with real order)
   - COD + online checkout
   - WhatsApp message delivery
   - AI widget visible on storefront pages

## Testing checklist

- [ ] Login → add to cart → COD checkout → lands on `/order-success/...`
- [ ] Login → online payment → Razorpay success → lands on `/order-success/...`
- [ ] Refresh order success page (no 404)
- [ ] Track order page loads status
- [ ] WhatsApp confirmation sent (or retry button works)
- [ ] AI widget opens and responds
- [ ] Mobile header/menu/checkout layout OK
- [ ] Legacy URLs redirect (`/products`, `/orders/success/:id`)

## Future issue prevention

- Never hardcode success URL paths outside `buildOrderSuccessPath()`.
- Always decode order numbers with `decodeOrderNumberParam()` before DB lookup.
- Keep `NEXT_PUBLIC_APP_URL` host aligned with live domain to avoid middleware redirect loops.
- Do not call `notFound()` for recoverable post-checkout states; use retry UI.
- Ensure WhatsApp image URLs are absolute (`getAppUrl()` based).
