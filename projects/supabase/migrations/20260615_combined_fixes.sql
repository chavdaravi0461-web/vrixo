-- ============================================================
-- COMBINED FIXES: WhatsApp trigger + Support tickets + PostgREST reload
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- 1. Drop the WhatsApp trigger that conflicts with direct send
DROP TRIGGER IF EXISTS queue_order_confirmation_whatsapp_trigger ON public.orders;

-- 2. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

-- 3. Verify order_items.product_id is TEXT (should return 'text')
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'order_items' AND column_name = 'product_id';

-- 4. Apply support tickets migration (idempotent - uses IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.order_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  changed_by text NOT NULL DEFAULT 'system',
  changed_by_id text,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_order_status_logs_order_id ON public.order_status_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_logs_created_at ON public.order_status_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS public.return_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'pickup_scheduled', 'pickup_done', 'item_received', 'refund_processed', 'completed', 'cancelled')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  pickup_address jsonb,
  pickup_date timestamptz,
  pickup_slot text,
  courier text,
  tracking_number text,
  admin_notes text,
  resolved_by text,
  resolved_at timestamptz,
  refund_amount numeric(10,2),
  refund_id text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON public.return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON public.return_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_requests_user_id ON public.return_requests(user_id);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  subject text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('order', 'payment', 'shipping', 'product', 'return', 'cancellation', 'account', 'general', 'complaint', 'other')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_on_customer', 'waiting_on_admin', 'resolved', 'closed')),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'whatsapp', 'email', 'phone', 'admin')),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_number text,
  metadata jsonb DEFAULT '{}'::jsonb,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_phone ON public.support_tickets(customer_phone);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON public.support_tickets(assigned_to);

CREATE TABLE IF NOT EXISTS public.ticket_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  author_role text NOT NULL DEFAULT 'customer' CHECK (author_role IN ('customer', 'admin', 'system')),
  is_admin boolean NOT NULL DEFAULT false,
  message text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  internal_note boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket_id ON public.ticket_replies(ticket_id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS return_status text,
  ADD COLUMN IF NOT EXISTS return_id uuid REFERENCES public.return_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_id text,
  ADD COLUMN IF NOT EXISTS refund_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS courier text,
  ADD COLUMN IF NOT EXISTS estimated_delivery timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1000 INCREMENT 1;

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $gen$
  SELECT 'SUP-' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || lpad(nextval('ticket_number_seq')::text, 4, '0');
$gen$;

CREATE OR REPLACE FUNCTION public.log_order_status(
  p_order_id uuid,
  p_from_status text,
  p_to_status text,
  p_changed_by text DEFAULT 'system',
  p_changed_by_id text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $log$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.order_status_logs (order_id, from_status, to_status, changed_by, changed_by_id, reason, metadata)
  VALUES (p_order_id, p_from_status, p_to_status, p_changed_by, p_changed_by_id, p_reason, p_metadata)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$log$;

CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text DEFAULT NULL,
  p_subject text DEFAULT 'Help Request',
  p_description text DEFAULT NULL,
  p_category text DEFAULT 'general',
  p_source text DEFAULT 'whatsapp',
  p_order_id uuid DEFAULT NULL,
  p_order_number text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $tkt$
DECLARE
  v_ticket_id uuid;
  v_ticket_number text;
BEGIN
  v_ticket_number := public.generate_ticket_number();
  INSERT INTO public.support_tickets (ticket_number, customer_name, customer_phone, customer_email, subject, description, category, source, order_id, order_number)
  VALUES (v_ticket_number, p_customer_name, p_customer_phone, p_customer_email, p_subject, coalesce(p_description, p_subject), p_category, p_source, p_order_id, p_order_number)
  RETURNING id INTO v_ticket_id;
  RETURN v_ticket_id;
END;
$tkt$;

CREATE OR REPLACE FUNCTION public.create_return_request(
  p_order_id uuid,
  p_order_number text,
  p_customer_name text,
  p_customer_phone text,
  p_reason text,
  p_customer_email text DEFAULT NULL,
  p_details text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $ret$
DECLARE
  v_return_id uuid;
BEGIN
  INSERT INTO public.return_requests (order_id, order_number, user_id, customer_name, customer_phone, customer_email, reason, details, items)
  VALUES (p_order_id, p_order_number, p_user_id, p_customer_name, p_customer_phone, p_customer_email, p_reason, p_details, p_items)
  RETURNING id INTO v_return_id;
  UPDATE public.orders SET return_status = 'requested', updated_at = timezone('utc', now()) WHERE id = p_order_id;
  RETURN v_return_id;
END;
$ret$;

CREATE OR REPLACE FUNCTION public.generate_ticket_number_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $trg$
BEGIN
  IF new.ticket_number IS NULL THEN
    new.ticket_number := public.generate_ticket_number();
  END IF;
  RETURN new;
END;
$trg$;

DROP TRIGGER IF EXISTS trg_support_tickets_generate_number ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_generate_number
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.generate_ticket_number_trigger();

GRANT USAGE ON SEQUENCE public.ticket_number_seq TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_ticket_number() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.log_order_status(uuid, text, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(text, text, text, text, text, text, text, uuid, text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.create_return_request(uuid, text, text, text, text, text, text, jsonb, uuid) TO service_role, authenticated;

-- Final schema reload
NOTIFY pgrst, 'reload schema';
