alter table public.orders
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text,
  add column if not exists razorpay_signature text,
  add column if not exists paid_at timestamptz;

alter table public.payments
  add column if not exists paid_at timestamptz;

update public.orders
set
  payment_method = case
    when lower(payment_method) in ('online', 'online payment') then 'online'
    else 'cod'
  end,
  payment_status = lower(payment_status),
  order_status = lower(order_status),
  razorpay_order_id = coalesce(razorpay_order_id, notes ->> 'razorpayOrderId'),
  razorpay_payment_id = coalesce(razorpay_payment_id, notes ->> 'razorpayPaymentId'),
  razorpay_signature = coalesce(razorpay_signature, notes ->> 'razorpaySignature')
where
  payment_method in ('Cash on Delivery', 'Online Payment')
  or payment_status <> lower(payment_status)
  or order_status <> lower(order_status)
  or razorpay_order_id is null
  or razorpay_payment_id is null
  or razorpay_signature is null;

update public.payments
set status = lower(status)
where status <> lower(status);

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('cod', 'online'));

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending', 'cod_pending', 'paid', 'failed', 'refunded'));

alter table public.orders drop constraint if exists orders_order_status_check;
alter table public.orders add constraint orders_order_status_check
  check (order_status in ('pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'));

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('pending', 'cod_pending', 'paid', 'failed', 'refunded'));

create index if not exists orders_razorpay_order_id_idx
  on public.orders (razorpay_order_id);

create index if not exists payments_provider_order_id_idx
  on public.payments (provider_order_id);
