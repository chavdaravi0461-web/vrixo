# Vrixo

Vrixo is a production-style Next.js e-commerce store for shoes and watches. It includes Supabase auth and database integration, COD and Razorpay online checkout flows, order history, admin management pages, coupon support, and modular Twilio SMS confirmation after order save.

## Tech stack

- Next.js 16 with App Router and TypeScript
- Tailwind CSS 4
- Zustand for cart and wishlist persistence
- Supabase for auth, database, and optional storage
- Twilio-ready SMS provider integration
- Vercel deployment with standard Next.js build output

## Features

- Premium storefront UI with home, shop, category, search, product, cart, checkout, wishlist, profile, orders, legal, and support pages
- Supabase Auth login and signup
- COD orders saved in the database with `cod_pending` payment status and stock reduction
- Razorpay online orders are created as pending internal orders first, then marked paid/confirmed only after server-side signature and payment verification
- SMS confirmation triggered only after successful order save
- Admin dashboard with products, orders, users, coupons, and analytics pages
- Product filtering, sorting, wishlist, coupon validation, and responsive layouts

## Project structure

```text
src/
  app/
    (store)/        storefront pages
    admin/          admin pages
    api/            Next.js route handlers for Vercel serverless functions
  components/
    admin/          admin UI modules
    store/          storefront UI modules
    ui/             shared design primitives
  data/             fallback product data
  lib/              auth, supabase, sms, state, helpers
  services/         product/admin service functions
  styles/           global styles
  types/            shared TypeScript types
supabase/
  schema.sql        tables, RLS, triggers, order RPC
  seed.sql          starter products and coupons
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SUPPORT_EMAIL=support@vrixo.in
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_SMS_FROM=your_twilio_phone_number
SMS_PROVIDER=twilio
WHATSAPP_CLOUD_API_TOKEN=your_whatsapp_cloud_api_token
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
WHATSAPP_ADMIN_NUMBER=919xxxxxxxxx
EMAIL_API_KEY=
RAZORPAY_KEY_ID=your_razorpay_key_id
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Run the Supabase schema:

- Open Supabase SQL Editor.
- Run [`supabase/schema.sql`](/c:/Users/PC/OneDrive/Documents/Desktop/dreamcart final 4/supabase/schema.sql).
- Run [`supabase/seed.sql`](/c:/Users/PC/OneDrive/Documents/Desktop/dreamcart final 4/supabase/seed.sql).

3. Start development:

```bash
npm run dev
```

4. Create a production build:

```bash
npm run build
```

5. Auth setup:

- Create `.env.local` in the project root if it does not already exist.
- Add your Supabase Project URL as `NEXT_PUBLIC_SUPABASE_URL`.
- Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` for browser-safe Supabase auth/session handling.
- Add `SUPABASE_SERVICE_ROLE_KEY` only on the server/Vercel environment for admin-safe writes.
- Restart `npm run dev` after changing env values.

## Admin access

- Sign up a normal account from the storefront.
- In Supabase SQL editor, promote the account to admin:

```sql
update public.profiles
set role = 'admin'
where email = 'your-admin-email@example.com';
```

- Then login at `/admin/login`.

## Order workflow

Cash on Delivery checkout runs in this order:

1. Validate the request and authenticated user.
2. Call the `create_order_with_items` RPC in Supabase.
3. Save the order snapshot and generate an order number.
4. Reduce stock in the same database transaction.
5. Mark `payment_method = cod`, `payment_status = cod_pending`, and `order_status = confirmed`.
6. Attempt SMS delivery with only the purchased products from that order.
7. Keep the order saved even if SMS delivery fails, and store SMS failure details.

Online payment checkout runs in this order:

1. Validate the request and authenticated user.
2. Create a Razorpay order from the backend only.
3. Save a matching internal Vrixo order as `payment_status = pending` and `order_status = pending`.
4. Open Razorpay Standard Checkout in the browser.
5. Send the internal order id, Razorpay payment id, order id, and signature to the backend after the success callback.
6. Verify the HMAC signature and captured payment details using `RAZORPAY_KEY_SECRET` on the backend.
7. Only after verification, update the internal order to `payment_status = paid`, `order_status = Confirmed`, save Razorpay metadata, reduce stock, clear cart, and show confirmation.
8. If the popup is closed, payment fails, or verification fails, the order stays pending/failed and is not confirmed.

## SMS setup

- Twilio is wired as the live provider structure in [`src/lib/sms.ts`](/c:/Users/PC/OneDrive/Documents/Desktop/dreamcart final 4/src/lib/sms.ts).
- Add valid Twilio credentials and a verified sender number in `.env.local`.
- If credentials are missing, the order is still saved and the SMS failure is logged to the order record.

## WhatsApp order automation

- WhatsApp Cloud API is now integrated in [`src/lib/whatsapp.ts`].
- Add `WHATSAPP_CLOUD_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ADMIN_NUMBER`, and `NOTIFICATION_WORKER_SECRET` to `.env.local`.
- Order notifications now store retryable queue items in the database and preserve analytics-grade delivery logs.
- When an order is confirmed, the customer receives an automated WhatsApp image with the product, order details, and delivery note.
- Admin also receives an optional WhatsApp notification if `WHATSAPP_ADMIN_NUMBER` is configured.
- Failed WhatsApp delivery is automatically retried on a secure worker endpoint until the message is sent or exhaustion.

## Online payment setup

- Razorpay Standard Checkout is wired for online payments.
- This is a Next.js project, so set `NEXT_PUBLIC_RAZORPAY_KEY_ID` for the browser checkout key.
- Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` only in server/deployment environment variables. Never expose `RAZORPAY_KEY_SECRET` in frontend code.
- Enable automatic payment capture in Razorpay so paid checkouts reach the captured state and can be confirmed immediately by the verify route.
- Razorpay Checkout can surface cards, UPI apps, wallets, and other supported payment methods based on your merchant configuration and customer device.
- The implementation follows Razorpay's official standard web checkout and signature verification flow.

## Vercel deployment

1. Push the repository to GitHub.
2. Import the repo in Vercel.
3. Use these settings:
   - Build command: `npm run build`
   - Install command: `npm install`
   - Framework preset: Next.js
4. Add the same environment variables from `.env.local` in Vercel Project Settings.
5. Deploy. The included `vercel.json` keeps the build settings explicit, and `.vercelignore` excludes local build/runtime artifacts.

Required Vercel payment variables:

```env
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Render deployment

1. Create a new Web Service in Render and connect your GitHub repository.
2. Set the Environment to `Node` and the Build Command to `npm install && npm run build`.
3. Set the Start Command to `npm run start`.
4. Add environment variables in Render's dashboard exactly as in `.env.local`.
5. If you use a custom domain, configure it in Render and add any required HTTPS settings.

Required Render environment variables:

```env
NEXT_PUBLIC_APP_URL=https://your-vrixo-app.onrender.com
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret_key
WHATSAPP_CLOUD_API_TOKEN=your_whatsapp_cloud_api_token
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
WHATSAPP_ADMIN_NUMBER=919xxxxxxxxx
NOTIFICATION_WORKER_SECRET=replace-with-a-secure-worker-secret
```

## Background notification retry worker

The project exposes a secure retry endpoint at:

`GET /api/notifications/retry?secret=YOUR_SECRET`

Trigger this URL from any scheduler or Render cron job every 5-10 minutes. The worker will process pending SMS/WhatsApp queue items, retry failures automatically, and store analytics-ready attempt history.

Example Render cron job:

`curl -X GET "https://your-vrixo-app.onrender.com/api/notifications/retry?secret=replace-with-a-secure-worker-secret"`

If you prefer header-based access, add `x-notification-worker-secret: YOUR_SECRET` instead of the query string.

## Notes

- Product browsing falls back to local sample data when Supabase is not configured, but auth, admin, orders, coupons, and SMS require a real Supabase project.
- Cash on Delivery is the default and fully implemented checkout method.
- The codebase is intentionally structured to stay beginner-friendly and Vercel-safe.
