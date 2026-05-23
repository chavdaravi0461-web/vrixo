insert into public.products (
  slug, title, category, subcategory, brand, short_description, full_description,
  price, original_price, discount_percent, currency, stock, sku, sizes, colors, images,
  featured, bestseller, new_arrival, rating, review_count, specifications
) values (
  'razorpay-test-product-5',
  'Razorpay Test Product',
  'shoes',
  'Payment Test',
  'DreamCart',
  'Low-value product for checking Razorpay checkout.',
  'A Rs.5 test product added for safely checking Razorpay order creation and payment verification.',
  5, 5, 0, 'INR', 999, 'DC-TEST-005',
  array[]::text[],
  array['Test'],
  array['/placeholder-product.svg'],
  true, false, true, 5, 1,
  '{"Purpose":"Payment testing","Amount":"Rs.5"}'::jsonb
)
on conflict (slug) do update
set
  title = excluded.title,
  category = excluded.category,
  subcategory = excluded.subcategory,
  brand = excluded.brand,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  original_price = excluded.original_price,
  discount_percent = excluded.discount_percent,
  currency = excluded.currency,
  stock = excluded.stock,
  sku = excluded.sku,
  sizes = excluded.sizes,
  colors = excluded.colors,
  images = excluded.images,
  featured = excluded.featured,
  bestseller = excluded.bestseller,
  new_arrival = excluded.new_arrival,
  rating = excluded.rating,
  review_count = excluded.review_count,
  specifications = excluded.specifications,
  updated_at = timezone('utc', now());
