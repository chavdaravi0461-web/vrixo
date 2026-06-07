# Vrixo WhatsApp Order Confirmation

## 1. Folder Structure

```text
supabase/migrations/
  20260607_whatsapp_order_outbox.sql
src/
  app/api/notifications/retry/route.ts
  app/api/webhooks/whatsapp/route.ts
  lib/env/server.ts
  lib/notification-queue.ts
  lib/whatsapp.ts
  services/orders/post-order-tasks.ts
  services/workers/notification-outbox-worker.ts
tests/
  whatsapp/order-confirmation.test.ts
worker/
  whatsapp-worker.ts
```

The database is the queue source of truth. The worker and authenticated cron route claim rows with leases and `FOR UPDATE SKIP LOCKED`, so multiple worker instances can run safely.

## 2. Environment Variables

```env
NEXT_PUBLIC_APP_URL=https://www.vrixo.in
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

WHATSAPP_CLOUD_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ORDER_TEMPLATE_NAME=order_confirmation_vrixo
WHATSAPP_TEMPLATE_LANGUAGE=en
WHATSAPP_GRAPH_API_VERSION=v23.0
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_WEBHOOK_SECRET=
META_APP_SECRET=

NOTIFICATION_WORKER_SECRET=
NOTIFICATION_POLL_INTERVAL_MS=2000
NOTIFICATION_BATCH_SIZE=25
CRON_SECRET=
```

`WHATSAPP_CLOUD_API_TOKEN` must be a permanent System User access token with `whatsapp_business_messaging`. `WHATSAPP_WEBHOOK_SECRET` or `META_APP_SECRET` must contain the Meta App Secret, not the webhook verify token.

## 3. Backend Flow

1. COD order insert or paid online-order update completes.
2. The database trigger calls `enqueue_order_confirmation_whatsapp`.
3. The unique `dedupe_key` prevents a second confirmation for the same order.
4. The API attempts immediate dispatch after order success.
5. A worker or authenticated cron claims any remaining notification.
6. Meta's accepted `wamid` is stored in `provider_message_id`.
7. Webhook statuses update `accepted`, `sent`, `delivered`, `read`, or `failed`.

The order transaction never depends on Meta availability. A WhatsApp outage cannot roll back a valid order.

## 4. Meta Template

Create and approve this utility template in WhatsApp Manager:

```text
Name: order_confirmation_vrixo
Language: en

Body variables:
{{1}} Customer Name
{{2}} Order ID
{{3}} Product Names
{{4}} Payment Method
{{5}} Delivery Address
{{6}} Order Amount
```

The application sends this approved template only. It does not fall back to free-form order text.

## 5. Database Changes

Apply:

```bash
supabase db push
```

Or execute `supabase/migrations/20260607_whatsapp_order_outbox.sql` in the Supabase SQL Editor.

The migration adds:

- Unique notification deduplication.
- Provider message ID correlation.
- Worker claim leases.
- Delivery/read timestamps.
- Atomic order triggers.
- Secure claim, enqueue, and completion RPCs.

## 6. Webhook Setup

In Meta Developer Dashboard:

```text
Callback URL: https://www.vrixo.in/api/webhooks/whatsapp
Verify token: the exact WHATSAPP_VERIFY_TOKEN value
Subscribed field: messages
```

Set the Meta App Secret as `WHATSAPP_WEBHOOK_SECRET`. The endpoint verifies `x-hub-signature-256` against the unmodified raw request body.

## 7. Testing

```bash
npm install
npx vitest run tests/whatsapp/order-confirmation.test.ts
npm run typecheck
npm run lint
```

Production smoke test:

1. Place one COD order with a real opted-in WhatsApp number.
2. Confirm one `order_notifications` row exists for the order.
3. Confirm the row stores a `provider_message_id`.
4. Confirm webhook updates reach `delivered` or `read`.
5. Replay checkout with the same idempotency key and confirm no second notification exists.
6. Temporarily use an invalid token and confirm retry scheduling.
7. Restore the token and confirm the worker sends the pending row.

Useful queries:

```sql
select id, order_id, status, attempts, provider_message_id,
       delivery_status, next_retry_at, last_error
from public.order_notifications
where provider = 'whatsapp'
order by created_at desc;

select *
from public.order_notification_attempts
order by created_at desc;
```

## 8. Deployment

1. Apply the migration before deploying application code.
2. Add all environment variables to the app and worker environments.
3. Deploy the Next.js app.
4. Run the durable worker on an always-on host:

```bash
npm ci
npm run worker:whatsapp
```

5. As a recovery path, schedule every minute:

```text
POST https://www.vrixo.in/api/notifications/retry
Authorization: Bearer <NOTIFICATION_WORKER_SECRET>
```

Do not rely on a Vercel serverless process as the always-on worker. Railway, Render, Fly.io, ECS, Kubernetes, or a managed VM are appropriate worker targets.

## 9. Production Checklist

- [ ] Meta Business is verified.
- [ ] Sending phone number is registered and healthy.
- [ ] `order_confirmation_vrixo` is approved with exactly six body variables.
- [ ] Permanent System User token is stored only in server environment variables.
- [ ] Meta App Secret and verify token are different values.
- [ ] Migration is applied before application deployment.
- [ ] At least one worker instance is running.
- [ ] Cron recovery endpoint is configured and authenticated.
- [ ] Webhook `messages` subscription is active.
- [ ] Alerts cover failed notifications and growing queue depth.
- [ ] Logs never contain access tokens or full customer phone numbers.
- [ ] Token rotation and Graph API version review are scheduled.
- [ ] Customer consent and opt-out handling meet applicable policy and law.
