alter table public.profiles
  add column if not exists full_name text;

update public.profiles
set full_name = nullif(name, '')
where full_name is null;

alter table public.products
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists compare_at_price numeric(10,2),
  add column if not exists is_active boolean not null default true;

update public.products
set
  name = coalesce(name, title),
  description = coalesce(description, full_description, short_description),
  compare_at_price = coalesce(compare_at_price, original_price),
  is_active = status = 'active'
where name is null or description is null or compare_at_price is null;

alter table public.orders
  add column if not exists customer_email text,
  add column if not exists shipping_fee numeric(10,2),
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text;

update public.orders
set
  customer_email = coalesce(customer_email, notes ->> 'email'),
  shipping_fee = coalesce(shipping_fee, shipping_charge),
  razorpay_order_id = coalesce(razorpay_order_id, notes ->> 'razorpayOrderId'),
  razorpay_payment_id = coalesce(razorpay_payment_id, notes ->> 'razorpayPaymentId')
where customer_email is null
  or shipping_fee is null
  or razorpay_order_id is null
  or razorpay_payment_id is null;

alter table public.product_reviews
  add column if not exists status text not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));

alter table public.contact_messages
  add column if not exists status text not null default 'new'
  check (status in ('new', 'read', 'resolved'));

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'resolved')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.newsletter_subscribers (email, created_at)
select email, created_at
from public.newsletter_subscriptions
on conflict (email) do nothing;

alter table public.contacts enable row level security;
alter table public.newsletter_subscribers enable row level security;

drop policy if exists "contacts_admin_all" on public.contacts;
create policy "contacts_admin_all" on public.contacts
for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
)
with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "newsletter_subscribers_admin_all" on public.newsletter_subscribers;
create policy "newsletter_subscribers_admin_all" on public.newsletter_subscribers
for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
)
with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "reviews_admin_all" on public.product_reviews;
create policy "reviews_admin_all" on public.product_reviews
for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
)
with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
