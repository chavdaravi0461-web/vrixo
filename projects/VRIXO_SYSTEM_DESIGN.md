VRIXO — Ultra-Premium E‑commerce Systems
========================================

Last updated: 2026-05-22

Overview
--------
This document captures a production-grade, modular, secure, and scalable implementation plan for five systems requested for VRIXO:

1. Delivery Tracking System
2. Admin Live Order Alerts
3. AI Abandoned Cart Recovery
4. GPT Customer Support (WhatsApp + Web)
5. Luxury Real-time Analytics Dashboard

Tech stack assumptions
---------------------
- Frontend: Next.js App Router (TypeScript), Tailwind CSS, Framer Motion
- Backend: Node.js (Next server actions + API routes), TypeScript
- DB: PostgreSQL (primary), Redis (caching, rate-limit), MongoDB (analytics/embeddings optional)
- Messaging: WhatsApp Cloud API, Telegram Bot API, Discord Webhooks
- Payments: Razorpay
- Queue/Workers: Postgres-backed queue + Redis for locks; background workers on Render
- AI: OpenAI API (gpt-4o-mini / function-calling for structured replies); embeddings stored in Mongo or pgvector
- Deployment: Vercel (frontend, serverless functions), Render (workers, cron), Sentry/Logflare for logging
- Observability: Prometheus + Grafana (or Datadog) for metrics

Goals & Non-Goals
-----------------
Goal: Provide production-ready architecture, DB schemas, API contracts, folder structure, environment variables, webhook designs, security considerations, and deployment steps. This deliverable includes scaffolding and reference implementations for core systems and example code patterns to follow.

Folder structure (recommended)
------------------------------
src/
  app/                        # Next.js App Router pages
    (store)/
      order-success/[orderNumber]/page.tsx
      checkout/
  components/
    ui/                        # design system (buttons, cards, modal)
    admin/                     # admin-specific components
    store/                     # store UI components
  lib/
    api/                       # API helpers
    whatsapp/                  # WhatsApp client wrappers
    notifications/             # queue + dispatcher
    shipments/                 # shipment providers & webhooks
    ai/                        # OpenAI helpers, embeddings
    auth/                      # supabase/auth or next-auth helpers
    db/                        # db clients and migrations helpers
    metrics/                   # telemetry helpers
    security/                  # webhooks validation, rate-limits
    utils/
  services/
    orders/                    # order creation & orchestration
    admin/                     # admin endpoints
    analytics/                 # aggregation & reports
    workers/                   # background worker code
  scripts/
    migrations/
    seed/
  cron/                        # small cron job definitions (for Render)
  pages/api/                   # legacy API if needed
  styles/
  types/

infrastructure/
  terraform/                   # optional infra as code (RDS, redis, render, vercel)
  nomad/ or docker/            # container configs for workers

migrations/
  2026xxxx_create_orders.sql

docs/
  ARCHITECTURE.md
  DEPLOYMENT.md
  RUNBOOK.md

Database Schemas (Postgres)
---------------------------
-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  items JSONB NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  payment_method TEXT,
  payment_status TEXT,
  order_status TEXT,
  shipping_address JSONB,
  customer_name TEXT,
  customer_phone TEXT,
  whatsapp_status TEXT,
  sms_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Notifications queue
CREATE TABLE order_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'sms' | 'whatsapp' | 'telegram' ...
  event_type TEXT NOT NULL, -- 'order_confirmation' | 'delivery_update'
  payload JSONB NOT NULL,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  status TEXT DEFAULT 'pending', -- pending, retry_scheduled, sent, failed
  last_error TEXT,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE order_notification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES order_notifications(id) ON DELETE CASCADE,
  attempt INT,
  status TEXT,
  error TEXT,
  response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Shipments
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  carrier TEXT, -- 'shiprocket' | 'delhivery' | 'bluedart'
  tracking_id TEXT,
  status TEXT,
  last_known_location JSONB,
  eta TIMESTAMP WITH TIME ZONE,
  raw_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Abandoned carts
CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL,
  session_id TEXT NULL,
  items JSONB,
  total NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  abandoned BOOLEAN DEFAULT true
);

-- AI support: embeddings (pgvector recommended)
CREATE TABLE support_faq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT,
  answer TEXT,
  embedding vector(1536) -- if using pgvector
);

Core APIs (contracts)
---------------------
- POST /api/orders
  - body: { email, shippingAddress, items, couponCode }
  - returns: { orderId, orderNumber, paymentMethod, paymentStatus, orderStatus, smsSent, whatsappSent }

- POST /api/payments/razorpay/verify
  - verifies signature, marks order paid, triggers notifications

- POST /api/shipments/webhook
  - handles carrier webhooks (validated by signature) -> updates shipments table -> creates delivery_update notifications

- POST /api/notifications/dispatch
  - admin-only endpoint to trigger manual resends

- Websocket: /ws/admin
  - authenticated admin socket; broadcasts new orders, high-value alerts, failed deliveries

Notification System (design)
----------------------------
- Use Postgres queue (order_notifications) as single source of truth
- Worker process (Render) polls `order_notifications` for pending notifications (limit 20)
- Worker executes provider-specific send; on failure, records attempt in `order_notification_attempts`, computes next_retry_at using exponential backoff with jitter
- If attempts >= max_attempts -> mark failed and notify admin immediately
- Use Redis for distributed locks to avoid duplicate processing if multiple workers

WhatsApp integration (production ready)
---------------------------------------
- Use WhatsApp Cloud API v17+
- Maintain `WHATSAPP_CLOUD_API_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` in secure env
- Implement `sendWhatsAppImageMessage` and `sendWhatsAppTextMessage` with robust error parsing
- Validate responses and map transient vs permanent errors
- Respect rate limits and backoff

Shipment tracking integration
-----------------------------
- Standardize carrier adapters with common interface:
  - createShipment(order) -> { tracking_id }
  - fetchTracking(tracking_id) -> { status, last_location, eta }
  - verifyWebhookSignature(request) -> boolean
- For each webhook event, update `shipments` and push notification to queue

Delivery ETA prediction
-----------------------
- Start with simple ETA from carrier + heuristics (distance, city-level avg)
- For better accuracy, train a small model (historical shipments table) that predicts delivery durations given origin/destination/postal codes and carrier
- Implement a background job that recalculates ETA after each tracking update

Admin Live Alerts (System)
--------------------------
- Emit events on order creation: new-order event -> push to `order_alerts` channel
- Multi-channel delivery:
  - WhatsApp: short text via WhatsApp Cloud API to admin number
  - Telegram: bot sendMessage
  - Discord: webhook POST
- Dashboard realtime: admin websocket subscribes to events; front-end updates via socket
- Sound: play brief audio asset on new order when tab visible; no autoplay otherwise
- High-value orders: trigger additional push to on-call or SMS
- Fraud detection: simple heuristics (ip mismatch, billing/delivery mismatch, rapid coupon use) and score orders; flag on admin dashboard

AI Abandoned Cart Recovery
--------------------------
- Capture `carts` with session_id and user_id
- When cart is `abandoned` after `x` minutes (configurable), schedule recovery campaign
- Worker builds context: items, total, recency, user purchase history, product categories
- Use OpenAI to generate subject + message variants using few-shot templates and customer's data
- Attach unique dynamic coupon codes (single-use; expire in 48h)
- Schedule WhatsApp sends with progressive cadence (1h, 24h, 48h) with backoff if opted out
- Track recovery conversions in `recoveries` table

AI Customer Support (WhatsApp GPT)
----------------------------------
- Build a WhatsApp webhook listener for incoming messages
- Route messages to GPT handler with function calling for structured actions:
  - order_lookup(order_id) -> query DB and return status
  - refund_status(order_id) -> query returns
  - product_availability(product_id)
- Use embeddings + kNN (pgvector/Mongo) for FAQ fallback
- Maintain short-term conversation context per chat (Redis with TTL)
- Escalation: when user asks for `human` or confidence low (<0.5), create a ticket and mark for human handoff
- Multi-language: detect language and call ChatGPT with appropriate system prompt or use translation pipeline

Analytics Dashboard
-------------------
- Backend aggregates daily/hourly data via materialized views or job (workers)
- Realtime: Websocket pushes live metrics (active users, live orders)
- Charts: Recharts components for line/area/bar, top-products table, conversion funnels
- Export: CSV/Excel via server-side endpoints (streaming)
- Heatmaps: optional third-party integrate (Hotjar/Fullstory) or self-hosted clickmap collector

Security & Rate limiting
------------------------
- All webhooks validated via signature + timestamp
- Rate-limit critical API endpoints (checkout, payment verify, webhook) using Redis token-bucket
- Store secrets in Vercel/Render secure env; never commit secrets
- Use CSP, HSTS, secure cookies, SameSite, and HTTPOnly
- Audit logs for admin actions

Logging & Monitoring
--------------------
- Structured logs (JSON) with request id
- Error tracking: Sentry
- Metrics: Prometheus metrics endpoint; Grafana dashboards
- Alerting: PagerDuty or email for repeated failures

Worker & Cron jobs
------------------
- Worker process responsibilities:
  - process pending notifications
  - process abandoned cart campaigns
  - fetch shipment updates (carrier polling if webhook unavailable)
  - process analytics aggregations
- Cron schedule examples (on Render):
  - every 1 minute: process notifications queue
  - every 5 minutes: fetch pending shipments
  - every 15 minutes: process abandoned carts

Webhook handlers
----------------
- `POST /api/shipments/webhook/:carrier`
  - validate signature
  - map carrier event to internal status
  - update shipments row and push delivery_update notification

- `POST /api/whatsapp/webhook` (incoming messages)
  - verify token
  - parse message -> hand to GPT handler or route to human

Deployment checklist
--------------------
- Postgres instance (AWS RDS or Supabase)
- Redis instance (ElastiCache or Upstash)
- Vercel: frontend + API routes
- Render: background workers + cron jobs
- Secrets stored in project environment on each platform
- CI: run lint, typecheck, tests, build, then deploy

Environment variables (minimum)
------------------------------
# Postgres
DATABASE_URL=postgres://user:pass@host:5432/vrixo

# Redis
REDIS_URL=redis://:password@host:6379

# WhatsApp
WHATSAPP_CLOUD_API_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ADMIN_NUMBER=91XXXXXXXXXX

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Razorpay
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...

# App
NEXT_PUBLIC_APP_URL=https://www.vrixo.in
JWT_SECRET=...
SENTRY_DSN=...

Key implementation patterns
---------------------------
- Use typed DTOs (zod) for API input validation
- Centralized error handler and response shapes
- Use feature flags (LaunchDarkly or simple db flags) for toggling heavy features
- Use circuit-breaker pattern for external APIs (WhatsApp, carriers)
- Design adapters for carriers/notification providers to keep internals provider-agnostic

Next steps I can take for you now
--------------------------------
- Scaffold the `src/lib/notifications` and worker `src/services/workers/notifications` files with production-ready queue processing code and retry/backoff logic.
- Scaffold the webhook handler for WhatsApp incoming messages and a GPT glue layer.
- Add SQL migration files for the DB schemas above.
- Create deployment manifests for Vercel + Render.

Tell me which of the next steps you'd like me to implement first; I can start scaffolding code and workers immediately.
