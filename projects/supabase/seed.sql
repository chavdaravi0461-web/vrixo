insert into public.categories (
  slug, name, description, image_url, is_active, sort_order
) values
('shoes', 'Shoes', 'Performance, lifestyle, and formal footwear.', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80', true, 1),
('watches', 'Watches', 'Premium watches for daily wear, gifting, and collectors.', 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=900&q=80', true, 2)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

insert into public.products (
  slug, title, category, subcategory, brand, short_description, full_description,
  price, original_price, discount_percent, currency, stock, sku, sizes, colors, images,
  featured, bestseller, new_arrival, rating, review_count, specifications
) values
(
  'razorpay-test-product-5',
  'Razorpay Test Product',
  'shoes',
  'Payment Test',
  'Vrixo',
  'Low-value product for checking Razorpay checkout.',
  'A Rs.5 test product added for safely checking Razorpay order creation and payment verification.',
  5, 5, 0, 'INR', 999, 'DC-TEST-005',
  array[]::text[],
  array['Test'],
  array['/placeholder-product.svg'],
  true, false, true, 5, 1,
  '{"Purpose":"Payment testing","Amount":"Rs.5"}'::jsonb
),
(
  'aeroflex-runner-navy',
  'Aeroflex Runner Navy',
  'shoes',
  'Running Shoes',
  'StrideLab',
  'Lightweight daily running shoe with responsive cushioning.',
  'Aeroflex Runner Navy blends breathable mesh, spring-loaded foam cushioning, and a stable heel cage for daily runs, commute wear, and long walking sessions.',
  3299, 4299, 23, 'INR', 24, 'DC-SHO-001',
  array['7','8','9','10'],
  array['Navy','White'],
  array[
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=900&q=80'
  ],
  true, true, false, 4.6, 118,
  '{"Material":"Engineered mesh","Sole":"EVA foam","Closure":"Lace-up","Warranty":"3 months"}'::jsonb
),
(
  'monarch-leather-loafer-tan',
  'Monarch Leather Loafer Tan',
  'shoes',
  'Formal Shoes',
  'Aureum',
  'Premium leather loafer built for sharp office dressing.',
  'Crafted with polished full-grain leather and cushioned inner support, Monarch Leather Loafer Tan brings a sleek formal finish without sacrificing comfort.',
  4599, 5799, 21, 'INR', 18, 'DC-SHO-002',
  array['8','9','10','11'],
  array['Tan','Brown'],
  array[
    'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=900&q=80'
  ],
  true, false, true, 4.4, 67,
  '{"Material":"Genuine leather","Sole":"TPR","Closure":"Slip-on","Occasion":"Formal"}'::jsonb
),
(
  'streetpulse-high-top-black',
  'StreetPulse High Top Black',
  'shoes',
  'Sneakers',
  'VaultKicks',
  'Cushioned high-top sneaker with bold street styling.',
  'StreetPulse High Top Black is made for city movement with padded ankle support, textured rubber grip, and a sharp monochrome silhouette.',
  3899, 4899, 20, 'INR', 14, 'DC-SHO-003',
  array['7','8','9','10','11'],
  array['Black','Grey'],
  array[
    'https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=900&q=80'
  ],
  false, true, true, 4.7, 141,
  '{"Material":"Synthetic leather","Sole":"Anti-slip rubber","Closure":"Lace-up","Style":"Streetwear"}'::jsonb
),
(
  'metro-knit-slip-on-grey',
  'Metro Knit Slip-On Grey',
  'shoes',
  'Casual Shoes',
  'UrbanPace',
  'Easy knit slip-on for office commutes and casual wear.',
  'Metro Knit Slip-On Grey keeps things effortless with a sock-like knit upper, flex grooves, and all-day cushioning for long city days.',
  2799, 3499, 20, 'INR', 30, 'DC-SHO-005',
  array['7','8','9','10'],
  array['Grey','Black'],
  array[
    'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=80'
  ],
  true, false, false, 4.3, 76,
  '{"Material":"Breathable knit","Sole":"Foam comfort","Closure":"Slip-on","Weight":"Lightweight"}'::jsonb
),
(
  'summit-pro-training-red',
  'Summit Pro Training Red',
  'shoes',
  'Training Shoes',
  'Kinetiq',
  'Stable training shoe for gym, HIIT, and cross training.',
  'Summit Pro Training Red uses a wide base, grippy outsole, and reinforced sidewalls to keep movement stable during dynamic indoor workouts.',
  3699, 4599, 20, 'INR', 22, 'DC-SHO-006',
  array['7','8','9','10','11'],
  array['Red','Black'],
  array[
    'https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=900&q=80'
  ],
  false, true, false, 4.5, 88,
  '{"Material":"Reinforced textile","Sole":"High-grip rubber","Closure":"Lace-up","Support":"Lateral stability"}'::jsonb
),
(
  'trailforge-outdoor-olive',
  'TrailForge Outdoor Olive',
  'shoes',
  'Outdoor Shoes',
  'PeakTrail',
  'Rugged outdoor shoe with strong traction and weather resistance.',
  'TrailForge Outdoor Olive is built for weekend trails and monsoon commutes, pairing water-resistant uppers with aggressive lug traction.',
  4999, 6499, 23, 'INR', 11, 'DC-SHO-004',
  array['8','9','10'],
  array['Olive','Black'],
  array[
    'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1517260911205-8e2d4bd7a0e6?auto=format&fit=crop&w=900&q=80'
  ],
  false, false, true, 4.5, 52,
  '{"Material":"Water-resistant mesh","Sole":"Deep-grip outsole","Closure":"Speed lacing","Use":"Outdoor"}'::jsonb
),
(
  'chronomaster-steel-blue',
  'ChronoMaster Steel Blue',
  'watches',
  'Chronograph',
  'Horologe',
  'Refined steel chronograph with sapphire-inspired dial depth.',
  'ChronoMaster Steel Blue pairs a brushed stainless-steel bracelet with a layered deep-blue dial, luminous markers, and a premium chronograph finish.',
  7899, 9999, 21, 'INR', 15, 'DC-WAT-001',
  array[]::text[],
  array['Steel Blue','Silver'],
  array[
    'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1547996160-81dfa63595aa?auto=format&fit=crop&w=900&q=80'
  ],
  true, true, true, 4.8, 132,
  '{"Dial":"Blue chronograph","Strap":"Stainless steel","Movement":"Quartz","WaterResistance":"5 ATM"}'::jsonb
),
(
  'aurora-minimal-rose-gold',
  'Aurora Minimal Rose Gold',
  'watches',
  'Fashion Watch',
  'Veloura',
  'Minimal rose-gold watch with clean everyday elegance.',
  'Aurora Minimal Rose Gold offers a slim polished case, soft leather strap, and elegant dial proportions designed for refined everyday styling.',
  4599, 5899, 22, 'INR', 21, 'DC-WAT-002',
  array[]::text[],
  array['Rose Gold','Beige'],
  array[
    'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=900&q=80'
  ],
  true, false, true, 4.4, 65,
  '{"Dial":"Sunray finish","Strap":"Genuine leather","Movement":"Quartz","CaseSize":"34 mm"}'::jsonb
),
(
  'voyager-gmt-black',
  'Voyager GMT Black',
  'watches',
  'Travel Watch',
  'NordicTime',
  'Dual-time travel watch with robust black case styling.',
  'Voyager GMT Black is built for travellers who want a confident wrist presence, dual-time readability, and dependable everyday durability.',
  9299, 11499, 19, 'INR', 9, 'DC-WAT-003',
  array[]::text[],
  array['Black','Orange'],
  array[
    'https://images.unsplash.com/photo-1547996160-81dfa63595aa?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1434056886845-dac89ffe9b56?auto=format&fit=crop&w=900&q=80'
  ],
  false, true, false, 4.7, 91,
  '{"Dial":"GMT dual-time","Strap":"Silicone","Movement":"Quartz GMT","WaterResistance":"10 ATM"}'::jsonb
),
(
  'helios-automatic-brown',
  'Helios Automatic Brown',
  'watches',
  'Automatic Watch',
  'LuxeAxis',
  'Mechanical automatic watch with exhibition back.',
  'Helios Automatic Brown offers mechanical charm with a textured ivory dial, exhibition back, and rich leather strap for classic watch lovers.',
  12499, 14999, 17, 'INR', 8, 'DC-WAT-004',
  array[]::text[],
  array['Brown','Ivory'],
  array[
    'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=900&q=80'
  ],
  true, false, false, 4.9, 49,
  '{"Dial":"Textured ivory","Strap":"Italian leather","Movement":"Automatic","CaseBack":"Exhibition"}'::jsonb
),
(
  'pulsefit-smart-black',
  'PulseFit Smart Black',
  'watches',
  'Smart Watch',
  'PulseX',
  'Fitness-first smart watch with AMOLED screen and call support.',
  'PulseFit Smart Black tracks workouts, heart rate, sleep, and notifications with a sharp AMOLED display and comfortable all-day strap.',
  5499, 6999, 21, 'INR', 27, 'DC-WAT-005',
  array[]::text[],
  array['Black','Graphite'],
  array[
    'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80'
  ],
  false, true, true, 4.3, 174,
  '{"Display":"AMOLED","Battery":"7 days","Connectivity":"Bluetooth calling","WaterResistance":"IP68"}'::jsonb
),
(
  'regent-classic-silver',
  'Regent Classic Silver',
  'watches',
  'Dress Watch',
  'CrownVale',
  'Slim silver dress watch with understated elegance.',
  'Regent Classic Silver is tailored for formal moments with a polished case, lean profile, and crisp white dial that sits elegantly under a shirt cuff.',
  6399, 7999, 20, 'INR', 16, 'DC-WAT-006',
  array[]::text[],
  array['Silver','White'],
  array[
    'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?auto=format&fit=crop&w=900&q=80'
  ],
  false, false, false, 4.5, 58,
  '{"Dial":"White minimal","Strap":"Steel mesh","Movement":"Quartz","CaseSize":"40 mm"}'::jsonb
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

insert into public.coupons (
  code, description, discount_type, discount_value, min_order_amount, active
) values
('DREAM10', '10 percent off on premium carts', 'percentage', 10, 2500, true),
('WATCH500', 'Flat Rs.500 off on watches and mixed carts', 'fixed', 500, 5000, true)
on conflict (code) do update
set
  description = excluded.description,
  discount_type = excluded.discount_type,
  discount_value = excluded.discount_value,
  min_order_amount = excluded.min_order_amount,
  active = excluded.active,
  updated_at = timezone('utc', now());
