-- 1. Add email provider to order_notifications constraint
ALTER TABLE public.order_notifications
  DROP CONSTRAINT IF EXISTS order_notifications_provider_check;

ALTER TABLE public.order_notifications
  ADD CONSTRAINT order_notifications_provider_check
  CHECK (provider IN ('sms', 'whatsapp', 'email'));

-- 2. Add contact preference to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contact_preference text
  DEFAULT 'whatsapp'
  CHECK (contact_preference IN ('email', 'whatsapp', 'both'));
