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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text unique,
  phone text,
  avatar text,
  addresses jsonb not null default '[]'::jsonb,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  slug text not null unique,
  title text not null,
  category text not null check (category in ('shoes', 'watches')),
  subcategory text not null default '',
  brand text not null default '',
  short_description text not null default '',
  full_description text not null default '',
  price numeric(10,2) not null default 0,
  original_price numeric(10,2) not null default 0,
  discount_percent integer not null default 0,
  currency text not null default 'INR',
  stock integer not null default 0,
  sku text not null unique,
  sizes text[] not null default '{}',
  colors text[] not null default '{}',
  images text[] not null default '{}',
  featured boolean not null default false,
  bestseller boolean not null default false,
  new_arrival boolean not null default false,
  highlighted boolean not null default false,
  rating numeric(3,2) not null default 0,
  review_count integer not null default 0,
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  specifications jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (product_id, image_url)
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null,
  landmark text,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  selected_size text,
  selected_color text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, product_id, selected_size, selected_color)
);

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, product_id)
);

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text not null default '',
  rating integer not null check (rating between 1 and 5),
  title text not null default '',
  comment text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (product_id, user_id)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null default '',
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(10,2) not null default 0,
  min_order_amount numeric(10,2) not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  address_id uuid references public.addresses(id) on delete set null,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  shipping_charge numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  payment_method text not null default 'cod' check (payment_method in ('cod', 'online')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'cod_pending', 'paid', 'failed', 'refunded')),
  order_status text not null default 'pending' check (order_status in ('pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled')),
  shipping_address jsonb not null,
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_email text not null default '',
  coupon_code text,
  sms_status text default 'pending',
  sms_error text,
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  paid_at timestamptz,
  notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  title text not null,
  sku text not null default '',
  price numeric(10,2) not null default 0,
  quantity integer not null default 1 check (quantity > 0),
  selected_size text,
  selected_color text,
  product_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'manual',
  provider_order_id text,
  provider_payment_id text,
  provider_signature text,
  amount numeric(10,2) not null default 0,
  currency text not null default 'INR',
  method text not null default '',
  status text not null default 'pending' check (status in ('pending', 'cod_pending', 'paid', 'failed', 'refunded')),
  raw_response jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.orders
  add column if not exists total_amount numeric(10,2) not null default 0,
  add column if not exists customer_email text not null default '',
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  alter column payment_method set default 'cod',
  alter column payment_status set default 'pending',
  alter column order_status set default 'pending';

alter table public.payments
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.orders
set total_amount = total
where total_amount = 0 and total <> 0;

update public.orders
set payment_method = case
  when lower(coalesce(payment_method, '')) in ('online', 'online payment') then 'online'
  else 'cod'
end;

update public.orders
set payment_status = case
  when lower(coalesce(payment_status, '')) in ('paid', 'success', 'captured') then 'paid'
  when lower(coalesce(payment_status, '')) in ('failed', 'failure') then 'failed'
  when lower(coalesce(payment_status, '')) in ('cod_pending', 'cash on delivery') then 'cod_pending'
  else 'pending'
end;

update public.orders
set order_status = case
  when lower(coalesce(order_status, '')) in ('confirmed', 'confirm', 'order confirmed') then 'confirmed'
  when lower(coalesce(order_status, '')) in ('processing', 'process') then 'processing'
  when lower(coalesce(order_status, '')) in ('packed', 'packaged') then 'packed'
  when lower(coalesce(order_status, '')) in ('shipped', 'ship') then 'shipped'
  when lower(coalesce(order_status, '')) in ('delivered', 'delivery complete') then 'delivered'
  when lower(coalesce(order_status, '')) in ('cancelled', 'canceled') then 'cancelled'
  else 'pending'
end;

update public.payments
set status = case
  when lower(coalesce(status, '')) in ('paid', 'success', 'captured') then 'paid'
  when lower(coalesce(status, '')) in ('failed', 'failure') then 'failed'
  when lower(coalesce(status, '')) in ('cod_pending', 'cash on delivery') then 'cod_pending'
  when lower(coalesce(status, '')) = 'refunded' then 'refunded'
  else 'pending'
end;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('cod', 'online'));

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending', 'cod_pending', 'paid', 'failed', 'refunded'));

alter table public.orders drop constraint if exists orders_order_status_check;
alter table public.orders add constraint orders_order_status_check
  check (order_status in ('pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'));

alter table public.payments alter column status set default 'pending';
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('pending', 'cod_pending', 'paid', 'failed', 'refunded'));

create table if not exists public.newsletter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  subject text not null,
  message text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_categories_slug on public.categories(slug);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_products_featured on public.products(featured);
create index if not exists idx_products_bestseller on public.products(bestseller);
create index if not exists idx_products_new_arrival on public.products(new_arrival);
create index if not exists idx_products_highlighted on public.products(highlighted);
create index if not exists idx_products_brand on public.products(brand);
create index if not exists idx_product_images_product_id on public.product_images(product_id);
create index if not exists idx_addresses_user_id on public.addresses(user_id);
create index if not exists idx_cart_items_user_id on public.cart_items(user_id);
create index if not exists idx_wishlists_user_id on public.wishlists(user_id);
create index if not exists idx_product_reviews_product_id on public.product_reviews(product_id);
create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_payments_provider_payment_id on public.payments(provider_payment_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute procedure public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute procedure public.set_updated_at();

drop trigger if exists addresses_set_updated_at on public.addresses;
create trigger addresses_set_updated_at
before update on public.addresses
for each row execute procedure public.set_updated_at();

drop trigger if exists cart_items_set_updated_at on public.cart_items;
create trigger cart_items_set_updated_at
before update on public.cart_items
for each row execute procedure public.set_updated_at();

drop trigger if exists product_reviews_set_updated_at on public.product_reviews;
create trigger product_reviews_set_updated_at
before update on public.product_reviews
for each row execute procedure public.set_updated_at();

drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at
before update on public.coupons
for each row execute procedure public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute procedure public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  profile_email text := nullif(new.email, '');
  profile_phone text := coalesce(
    nullif(new.phone, ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  );
begin
  insert into public.profiles (id, name, email, phone)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      case
        when profile_email is not null then split_part(profile_email, '@', 1)
        when profile_phone is not null then 'Customer ' || right(regexp_replace(profile_phone, '\D', '', 'g'), 4)
        else 'Customer'
      end
    ),
    profile_email,
    profile_phone
  )
  on conflict (id) do update
  set
    name = coalesce(nullif(excluded.name, ''), public.profiles.name),
    email = coalesce(excluded.email, public.profiles.email),
    phone = coalesce(excluded.phone, public.profiles.phone);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.refresh_profile_addresses_cache(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  addresses_json jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'fullName', full_name,
        'phone', phone,
        'line1', line1,
        'line2', line2,
        'city', city,
        'state', state,
        'postalCode', postal_code,
        'country', country,
        'landmark', landmark
      )
      order by is_default desc, created_at desc
    ),
    '[]'::jsonb
  )
    into addresses_json
  from public.addresses
  where user_id = p_user_id;

  update public.profiles
  set addresses = addresses_json
  where id = p_user_id;
end;
$$;

create or replace function public.sync_profile_addresses_from_addresses()
returns trigger
language plpgsql
security definer
as $$
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  perform public.refresh_profile_addresses_cache(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists addresses_refresh_profile_cache on public.addresses;
create trigger addresses_refresh_profile_cache
after insert or update or delete on public.addresses
for each row execute procedure public.sync_profile_addresses_from_addresses();

create or replace function public.sync_addresses_from_profile_cache()
returns trigger
language plpgsql
security definer
as $$
declare
  address_entry jsonb;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  delete from public.addresses where user_id = new.id;

  for address_entry in
    select * from jsonb_array_elements(coalesce(new.addresses, '[]'::jsonb))
  loop
    insert into public.addresses (
      id,
      user_id,
      full_name,
      phone,
      line1,
      line2,
      city,
      state,
      postal_code,
      country,
      landmark,
      is_default
    )
    values (
      coalesce((address_entry ->> 'id')::uuid, gen_random_uuid()),
      new.id,
      coalesce(address_entry ->> 'fullName', ''),
      coalesce(address_entry ->> 'phone', ''),
      coalesce(address_entry ->> 'line1', ''),
      nullif(address_entry ->> 'line2', ''),
      coalesce(address_entry ->> 'city', ''),
      coalesce(address_entry ->> 'state', ''),
      coalesce(address_entry ->> 'postalCode', ''),
      coalesce(address_entry ->> 'country', ''),
      nullif(address_entry ->> 'landmark', ''),
      false
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists profiles_sync_addresses_table on public.profiles;
create trigger profiles_sync_addresses_table
after update of addresses on public.profiles
for each row execute procedure public.sync_addresses_from_profile_cache();

create or replace function public.ensure_product_category()
returns trigger
language plpgsql
security definer
as $$
declare
  category_id_value uuid;
begin
  if new.category is null or trim(new.category) = '' then
    return new;
  end if;

  insert into public.categories (slug, name)
  values (
    new.category,
    initcap(replace(new.category, '-', ' '))
  )
  on conflict (slug) do update
  set name = excluded.name
  returning id into category_id_value;

  new.category_id = category_id_value;
  return new;
end;
$$;

drop trigger if exists products_ensure_category on public.products;
create trigger products_ensure_category
before insert or update of category on public.products
for each row execute procedure public.ensure_product_category();

create or replace function public.sync_product_images_from_array()
returns trigger
language plpgsql
security definer
as $$
begin
  delete from public.product_images where product_id = new.id;

  insert into public.product_images (product_id, image_url, alt_text, sort_order, is_primary)
  select
    new.id,
    image_url,
    new.title,
    ordinality - 1,
    ordinality = 1
  from unnest(new.images) with ordinality as images(image_url, ordinality);

  return new;
end;
$$;

drop trigger if exists products_sync_images on public.products;
create trigger products_sync_images
after insert or update of images on public.products
for each row execute procedure public.sync_product_images_from_array();

create or replace function public.set_review_user_name()
returns trigger
language plpgsql
security definer
as $$
declare
  review_user_name text;
begin
  select name into review_user_name
  from public.profiles
  where id = new.user_id;

  new.user_name = coalesce(review_user_name, 'Customer');
  return new;
end;
$$;

drop trigger if exists product_reviews_set_user_name on public.product_reviews;
create trigger product_reviews_set_user_name
before insert or update on public.product_reviews
for each row execute procedure public.set_review_user_name();

create or replace function public.refresh_product_rating(p_product_id uuid)
returns void
language plpgsql
as $$
declare
  avg_rating numeric(3,2);
  total_reviews integer;
begin
  select coalesce(avg(rating), 0), count(*)
    into avg_rating, total_reviews
  from public.product_reviews
  where product_id = p_product_id;

  update public.products
  set rating = avg_rating,
      review_count = total_reviews
  where id = p_product_id;
end;
$$;

create or replace function public.sync_product_review_stats()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_product_rating(coalesce(new.product_id, old.product_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists product_reviews_stats on public.product_reviews;
create trigger product_reviews_stats
after insert or update or delete on public.product_reviews
for each row execute procedure public.sync_product_review_stats();

create or replace function public.create_order_with_items(
  p_user_id uuid,
  p_user_email text,
  p_items jsonb,
  p_shipping_address jsonb,
  p_coupon_code text default null,
  p_payment_method text default 'cod'
)
returns table (
  order_id uuid,
  order_number text,
  order_status text,
  total numeric,
  customer_name text,
  customer_phone text,
  sms_item_names text,
  sms_total_qty integer
)
language plpgsql
security definer
as $$
declare
  item jsonb;
  snapshot_item jsonb;
  product_row public.products%rowtype;
  profile_row public.profiles%rowtype;
  coupon_row public.coupons%rowtype;
  subtotal_value numeric(10,2) := 0;
  discount_value numeric(10,2) := 0;
  shipping_value numeric(10,2) := 99;
  total_value numeric(10,2) := 0;
  order_number_value text := 'DC-' || to_char(timezone('utc', now()), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  snapshot_items jsonb := '[]'::jsonb;
  order_id_value uuid := gen_random_uuid();
  address_id_value uuid;
  total_qty integer := 0;
  item_names text[] := '{}';
  payment_meta jsonb := coalesce(p_shipping_address -> 'paymentMeta', '{}'::jsonb);
  is_online_payment boolean := lower(coalesce(p_payment_method, 'cod')) in ('online', 'online payment');
begin
  select * into profile_row
  from public.profiles
  where id = p_user_id;

  if profile_row.id is null then
    raise exception 'User profile not found.';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty.';
  end if;

  if is_online_payment and (
    nullif(payment_meta ->> 'razorpayOrderId', '') is null or
    nullif(payment_meta ->> 'razorpayPaymentId', '') is null or
    nullif(payment_meta ->> 'razorpaySignature', '') is null
  ) then
    raise exception 'Verified Razorpay payment metadata is required before creating an online order.';
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    select * into product_row
    from public.products
    where id = (item ->> 'productId')::uuid
    for update;

    if product_row.id is null then
      raise exception 'Product not found.';
    end if;

    if product_row.stock < (item ->> 'quantity')::integer then
      raise exception 'Insufficient stock for %.', product_row.title;
    end if;

    subtotal_value := subtotal_value + (product_row.price * (item ->> 'quantity')::integer);
    total_qty := total_qty + (item ->> 'quantity')::integer;
    item_names := array_append(item_names, product_row.title);

    snapshot_items := snapshot_items || jsonb_build_array(
      jsonb_build_object(
        'productId', product_row.id,
        'slug', product_row.slug,
        'title', product_row.title,
        'image', coalesce(product_row.images[1], ''),
        'price', product_row.price,
        'quantity', (item ->> 'quantity')::integer,
        'stock', product_row.stock,
        'sku', product_row.sku,
        'selectedSize', item ->> 'selectedSize',
        'selectedColor', item ->> 'selectedColor'
      )
    );
  end loop;

  if subtotal_value >= 4999 then
    shipping_value := 0;
  end if;

  if p_coupon_code is not null and p_coupon_code <> '' then
    select * into coupon_row
    from public.coupons
    where code = upper(p_coupon_code)
      and active = true
      and (starts_at is null or starts_at <= timezone('utc', now()))
      and (ends_at is null or ends_at >= timezone('utc', now()));

    if coupon_row.id is not null and subtotal_value >= coupon_row.min_order_amount then
      if coupon_row.discount_type = 'percentage' then
        discount_value := round((subtotal_value * coupon_row.discount_value) / 100);
      else
        discount_value := coupon_row.discount_value;
      end if;
    end if;
  end if;

  total_value := subtotal_value + shipping_value - discount_value;

  insert into public.addresses (
    user_id,
    full_name,
    phone,
    line1,
    line2,
    city,
    state,
    postal_code,
    country,
    landmark,
    is_default
  ) values (
    p_user_id,
    coalesce(p_shipping_address ->> 'fullName', profile_row.name),
    coalesce(p_shipping_address ->> 'phone', profile_row.phone, ''),
    coalesce(p_shipping_address ->> 'line1', ''),
    nullif(p_shipping_address ->> 'line2', ''),
    coalesce(p_shipping_address ->> 'city', ''),
    coalesce(p_shipping_address ->> 'state', ''),
    coalesce(p_shipping_address ->> 'postalCode', ''),
    coalesce(p_shipping_address ->> 'country', ''),
    nullif(p_shipping_address ->> 'landmark', ''),
    false
  )
  returning id into address_id_value;

  insert into public.orders (
    id,
    order_number,
    user_id,
    address_id,
    items,
    subtotal,
    discount,
    shipping_charge,
    total,
    total_amount,
    payment_method,
    payment_status,
    order_status,
    shipping_address,
    customer_name,
    customer_phone,
    customer_email,
    coupon_code,
    notes
  ) values (
    order_id_value,
    order_number_value,
    p_user_id,
    address_id_value,
    snapshot_items,
    subtotal_value,
    discount_value,
    shipping_value,
    total_value,
    total_value,
    case when is_online_payment then 'online' else 'cod' end,
    case when is_online_payment then 'paid' else 'cod_pending' end,
    'confirmed',
    p_shipping_address,
    coalesce(p_shipping_address ->> 'fullName', profile_row.name),
    coalesce(p_shipping_address ->> 'phone', profile_row.phone, ''),
    coalesce(p_user_email, profile_row.email, ''),
    upper(nullif(p_coupon_code, '')),
    jsonb_build_object('email', p_user_email)
  );

  for snapshot_item in
    select * from jsonb_array_elements(snapshot_items)
  loop
    insert into public.order_items (
      order_id,
      product_id,
      title,
      sku,
      price,
      quantity,
      selected_size,
      selected_color,
      product_snapshot
    )
    values (
      order_id_value,
      (snapshot_item ->> 'productId')::uuid,
      coalesce(snapshot_item ->> 'title', ''),
      coalesce(snapshot_item ->> 'sku', ''),
      coalesce((snapshot_item ->> 'price')::numeric, 0),
      coalesce((snapshot_item ->> 'quantity')::integer, 1),
      nullif(snapshot_item ->> 'selectedSize', ''),
      nullif(snapshot_item ->> 'selectedColor', ''),
      snapshot_item
    );
  end loop;

  insert into public.payments (
    order_id,
    provider,
    provider_order_id,
    provider_payment_id,
    provider_signature,
    amount,
    currency,
    method,
    status,
    raw_response
  ) values (
    order_id_value,
    case
      when is_online_payment then coalesce(payment_meta ->> 'provider', 'razorpay')
      else 'manual'
    end,
    nullif(payment_meta ->> 'razorpayOrderId', ''),
    nullif(payment_meta ->> 'razorpayPaymentId', ''),
    nullif(payment_meta ->> 'razorpaySignature', ''),
    total_value,
    'INR',
    case when is_online_payment then 'online' else 'cod' end,
    case when is_online_payment then 'paid' else 'cod_pending' end,
    payment_meta
  );

  for item in select * from jsonb_array_elements(p_items)
  loop
    update public.products
    set stock = stock - (item ->> 'quantity')::integer
    where id = (item ->> 'productId')::uuid;
  end loop;

  return query
  select
    order_id_value,
    order_number_value,
    'confirmed',
    total_value,
    coalesce(p_shipping_address ->> 'fullName', profile_row.name),
    coalesce(p_shipping_address ->> 'phone', profile_row.phone, ''),
    array_to_string(item_names, ', '),
    total_qty;
end;
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.addresses enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.product_reviews enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.newsletter_subscriptions enable row level security;
alter table public.contact_messages enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id);

drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories
for select using (is_active = true);

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
for select using (status = 'active');

drop policy if exists "product_images_public_read" on public.product_images;
create policy "product_images_public_read" on public.product_images
for select using (true);

drop policy if exists "addresses_select_own" on public.addresses;
create policy "addresses_select_own" on public.addresses
for select using (auth.uid() = user_id);

drop policy if exists "addresses_insert_own" on public.addresses;
create policy "addresses_insert_own" on public.addresses
for insert with check (auth.uid() = user_id);

drop policy if exists "addresses_update_own" on public.addresses;
create policy "addresses_update_own" on public.addresses
for update using (auth.uid() = user_id);

drop policy if exists "addresses_delete_own" on public.addresses;
create policy "addresses_delete_own" on public.addresses
for delete using (auth.uid() = user_id);

drop policy if exists "cart_items_select_own" on public.cart_items;
create policy "cart_items_select_own" on public.cart_items
for select using (auth.uid() = user_id);

drop policy if exists "cart_items_insert_own" on public.cart_items;
create policy "cart_items_insert_own" on public.cart_items
for insert with check (auth.uid() = user_id);

drop policy if exists "cart_items_update_own" on public.cart_items;
create policy "cart_items_update_own" on public.cart_items
for update using (auth.uid() = user_id);

drop policy if exists "cart_items_delete_own" on public.cart_items;
create policy "cart_items_delete_own" on public.cart_items
for delete using (auth.uid() = user_id);

drop policy if exists "wishlists_select_own" on public.wishlists;
create policy "wishlists_select_own" on public.wishlists
for select using (auth.uid() = user_id);

drop policy if exists "wishlists_insert_own" on public.wishlists;
create policy "wishlists_insert_own" on public.wishlists
for insert with check (auth.uid() = user_id);

drop policy if exists "wishlists_delete_own" on public.wishlists;
create policy "wishlists_delete_own" on public.wishlists
for delete using (auth.uid() = user_id);

drop policy if exists "reviews_public_read" on public.product_reviews;
create policy "reviews_public_read" on public.product_reviews
for select using (true);

drop policy if exists "reviews_insert_own" on public.product_reviews;
create policy "reviews_insert_own" on public.product_reviews
for insert with check (auth.uid() = user_id);

drop policy if exists "reviews_update_own" on public.product_reviews;
create policy "reviews_update_own" on public.product_reviews
for update using (auth.uid() = user_id);

drop policy if exists "reviews_delete_own" on public.product_reviews;
create policy "reviews_delete_own" on public.product_reviews
for delete using (auth.uid() = user_id);

drop policy if exists "coupons_public_read" on public.coupons;
create policy "coupons_public_read" on public.coupons
for select using (
  active = true
  and (starts_at is null or starts_at <= timezone('utc', now()))
  and (ends_at is null or ends_at >= timezone('utc', now()))
);

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
for select using (auth.uid() = user_id);

drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own" on public.order_items
for select using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
for select using (
  exists (
    select 1
    from public.orders
    where orders.id = payments.order_id
      and orders.user_id = auth.uid()
  )
);
