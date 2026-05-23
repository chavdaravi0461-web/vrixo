# Vrixo Supabase Security Apply Steps

Run this manually in Supabase. Do not run it blindly on live data without backup.

## 1. Backup First

1. Open Supabase Dashboard.
2. Open your Vrixo project.
3. Export/backup the database from Supabase before changing RLS.
4. Confirm your admin user exists in Supabase Auth.

## 2. Open SQL Editor

1. Go to Supabase Dashboard.
2. Open `SQL Editor`.
3. Create a new query tab.

## 3. Run Preflight Checks

Before running the full security script, run these checks from `supabase/security.sql` comments:

```sql
select column_name, data_type, udt_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'products'
  and column_name in ('images', 'image_url', 'status', 'is_active');

select id, email, role, is_active
from public.profiles
where role = 'admin';

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects';
```

If no admin profile exists, manually promote your existing Supabase Auth user:

```sql
update public.profiles
set role = 'admin', is_active = true
where email = 'YOUR_ADMIN_EMAIL_HERE';
```

Replace `YOUR_ADMIN_EMAIL_HERE` with your real admin email. Do this only in Supabase SQL Editor, never from frontend code.

## 4. Run Security SQL

1. Open `supabase/security.sql` from this repo.
2. Paste the full file into Supabase SQL Editor.
3. Run it once.
4. It is designed to be rerunnable, but review notices after execution.

## 5. Run Verification SQL

1. Open `supabase/verify-security.sql`.
2. Paste the full file into Supabase SQL Editor.
3. Run it.
4. Review PASS/FAIL rows.
5. Investigate every FAIL before launch.

## 6. Manually Review Storage Policies

Run:

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects';
```

Final intended `product-images` storage rules:

- Public/anonymous can read product images.
- Only admin users can upload product images.
- Only admin users can update product images.
- Only admin users can delete product images.
- No anonymous/customer write policy should exist for `bucket_id = 'product-images'`.

Remove any old broad storage write policy that allows anon/authenticated upload to `product-images` without `public.is_admin(auth.uid())`.

## 7. Test Anonymous User

1. Open homepage in incognito.
2. Open `/shop`.
3. Confirm active products display.
4. Confirm product images load from Supabase URL or fallback only.
5. Try opening `/admin`; it should show login/blocked state.
6. Anonymous user must not upload product images.

## 8. Test Customer User

1. Login/signup as a normal customer.
2. Open `/shop` and product detail.
3. Add to cart.
4. Place COD order.
5. Confirm COD order is `cod_pending` or equivalent, not paid.
6. Confirm customer can view only their own orders.
7. Confirm customer cannot open admin dashboard.
8. Confirm customer cannot call admin product/order APIs.

## 9. Test Admin User

1. Login as your admin Supabase Auth user.
2. Complete admin access-code step if enabled.
3. Open `/admin`.
4. Add product.
5. Upload JPG image from computer/mobile.
6. Upload PNG image from computer/mobile.
7. Upload WebP image from computer/mobile.
8. Confirm SVG/GIF/PDF/ZIP/EXE or fake MIME files are blocked.
9. Edit product.
10. Archive/delete product only after confirmation.
11. Confirm new product appears on `/shop`.

## 10. Test Razorpay Online Order

1. Place online order using Razorpay test mode.
2. Confirm order starts as `pending`.
3. Confirm frontend cannot mark order paid by itself.
4. Complete valid Razorpay payment.
5. Confirm server verification marks payment `paid` and order `confirmed`.
6. Try invalid signature in test API call; it must not mark paid.
7. Confirm invalid verification cannot affect another customer order.

## 11. Final Live Checks

1. Deploy to Vercel after SQL passes.
2. Open `https://https://vrixo.in`.
3. View page source and search:
   - `C:\`
   - `file://`
   - `OneDrive`
   - `Pictures`
   - `Screenshots`
4. Confirm none appear.
5. Test homepage, `/shop`, product detail, cart, COD, Razorpay, admin login, admin upload.

Final principle:

Admin access code alone = weak. Supabase Auth + admin role + RLS + server-side verification = strong.
