create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

alter table if exists public.profiles
  add column if not exists name text not null default '',
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists avatar text,
  add column if not exists addresses jsonb not null default '[]'::jsonb,
  add column if not exists role text not null default 'customer',
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table if exists public.categories
  add column if not exists slug text,
  add column if not exists name text,
  add column if not exists description text not null default '',
  add column if not exists image_url text,
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table if exists public.products
  add column if not exists category_id uuid,
  add column if not exists slug text,
  add column if not exists title text,
  add column if not exists category text not null default 'shoes',
  add column if not exists subcategory text not null default '',
  add column if not exists brand text not null default '',
  add column if not exists short_description text not null default '',
  add column if not exists full_description text not null default '',
  add column if not exists price numeric(10,2) not null default 0,
  add column if not exists original_price numeric(10,2) not null default 0,
  add column if not exists discount_percent integer not null default 0,
  add column if not exists currency text not null default 'INR',
  add column if not exists stock integer not null default 0,
  add column if not exists sku text,
  add column if not exists sizes text[] not null default '{}',
  add column if not exists colors text[] not null default '{}',
  add column if not exists images text[] not null default '{}',
  add column if not exists featured boolean not null default false,
  add column if not exists bestseller boolean not null default false,
  add column if not exists new_arrival boolean not null default false,
  add column if not exists rating numeric(3,2) not null default 0,
  add column if not exists review_count integer not null default 0,
  add column if not exists status text not null default 'active',
  add column if not exists specifications jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.products
set category = case
  when lower(coalesce(category, '')) = 'watches' then 'watches'
  else 'shoes'
end
where to_regclass('public.products') is not null;

alter table if exists public.addresses
  add column if not exists user_id uuid,
  add column if not exists full_name text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists line1 text not null default '',
  add column if not exists line2 text,
  add column if not exists city text not null default '',
  add column if not exists state text not null default '',
  add column if not exists postal_code text not null default '',
  add column if not exists country text not null default 'India',
  add column if not exists landmark text,
  add column if not exists is_default boolean not null default false,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table if exists public.orders
  add column if not exists order_number text,
  add column if not exists user_id uuid,
  add column if not exists address_id uuid,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists subtotal numeric(10,2) not null default 0,
  add column if not exists discount numeric(10,2) not null default 0,
  add column if not exists shipping_charge numeric(10,2) not null default 0,
  add column if not exists total numeric(10,2) not null default 0,
  add column if not exists total_amount numeric(10,2) not null default 0,
  add column if not exists payment_method text not null default 'cod',
  add column if not exists payment_status text not null default 'pending',
  add column if not exists order_status text not null default 'pending',
  add column if not exists shipping_address jsonb not null default '{}'::jsonb,
  add column if not exists customer_name text not null default '',
  add column if not exists customer_phone text not null default '',
  add column if not exists customer_email text not null default '',
  add column if not exists coupon_code text,
  add column if not exists sms_status text default 'pending',
  add column if not exists sms_error text,
  add column if not exists whatsapp_status text default 'pending',
  add column if not exists whatsapp_error text,
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text,
  add column if not exists razorpay_signature text,
  add column if not exists paid_at timestamptz,
  add column if not exists notes jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.orders
set total_amount = total
where to_regclass('public.orders') is not null
  and total_amount = 0
  and total <> 0;

update public.orders
set payment_method = case
  when lower(coalesce(payment_method, '')) in ('online', 'online payment') then 'online'
  else 'cod'
end
where to_regclass('public.orders') is not null;

update public.orders
set payment_status = case
  when lower(coalesce(payment_status, '')) in ('paid', 'success', 'captured') then 'paid'
  when lower(coalesce(payment_status, '')) in ('failed', 'failure') then 'failed'
  when lower(coalesce(payment_status, '')) in ('cod_pending', 'cash on delivery') then 'cod_pending'
  when lower(coalesce(payment_status, '')) = 'refunded' then 'refunded'
  else 'pending'
end
where to_regclass('public.orders') is not null;

update public.orders
set order_status = case
  when lower(coalesce(order_status, '')) in ('confirmed', 'confirm', 'order confirmed') then 'confirmed'
  when lower(coalesce(order_status, '')) in ('processing', 'process') then 'processing'
  when lower(coalesce(order_status, '')) in ('packed', 'packaged') then 'packed'
  when lower(coalesce(order_status, '')) in ('shipped', 'ship') then 'shipped'
  when lower(coalesce(order_status, '')) in ('delivered', 'delivery complete') then 'delivered'
  when lower(coalesce(order_status, '')) in ('cancelled', 'canceled') then 'cancelled'
  else 'pending'
end
where to_regclass('public.orders') is not null;

alter table if exists public.order_items
  add column if not exists order_id uuid,
  add column if not exists product_id uuid,
  add column if not exists title text not null default '',
  add column if not exists sku text not null default '',
  add column if not exists price numeric(10,2) not null default 0,
  add column if not exists quantity integer not null default 1,
  add column if not exists selected_size text,
  add column if not exists selected_color text,
  add column if not exists product_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table if exists public.payments
  add column if not exists order_id uuid,
  add column if not exists provider text not null default 'manual',
  add column if not exists provider_order_id text,
  add column if not exists provider_payment_id text,
  add column if not exists provider_signature text,
  add column if not exists amount numeric(10,2) not null default 0,
  add column if not exists currency text not null default 'INR',
  add column if not exists method text not null default '',
  add column if not exists status text not null default 'pending',
  add column if not exists raw_response jsonb not null default '{}'::jsonb,
  add column if not exists paid_at timestamptz,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.payments
set status = case
  when lower(coalesce(status, '')) in ('paid', 'success', 'captured') then 'paid'
  when lower(coalesce(status, '')) in ('failed', 'failure') then 'failed'
  when lower(coalesce(status, '')) in ('cod_pending', 'cash on delivery') then 'cod_pending'
  when lower(coalesce(status, '')) = 'refunded' then 'refunded'
  else 'pending'
end
where to_regclass('public.payments') is not null;
