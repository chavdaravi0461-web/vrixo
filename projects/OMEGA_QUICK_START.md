# Omega Admin Panel - Developer Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Start Development Server
```bash
cd c:\dreamcart-final-4\projects
npm run dev
# Server runs on http://localhost:3000
```

### 2. Access Admin Pages
```
http://localhost:3000/dashboard-admin-vrixo-ravi/
# Requires admin authentication
```

### 3. Key File Map
```
src/
├── app/dashboard-admin-vrixo-ravi/
│   ├── page.tsx                    # Command Center (main dashboard)
│   ├── omega-demo/page.tsx        # Demo showcase with stats
│   ├── orders/page.tsx            # Orders management
│   ├── products/page.tsx          # Products catalog
│   └── analytics/page.tsx         # Analytics dashboard
├── components/
│   ├── admin/
│   │   ├── omega-shell.tsx        # Premium shell container
│   │   └── admin-shell.tsx        # Export wrapper
│   └── omega/
│       ├── index.tsx              # Component barrel export
│       ├── header.tsx             # Top navigation
│       ├── sidebar.tsx            # Left sidebar
│       ├── card.tsx               # Reusable card
│       ├── button.tsx             # Button components
│       ├── status-card.tsx        # KPI metric card
│       ├── modal.tsx              # Modal overlay
│       └── analytics-chart.tsx    # Chart component
├── styles/
│   ├── omega.css                  # Design tokens + base styles
│   └── omega-extra.css            # Advanced component styles
└── lib/omega/
    └── mock-data.ts              # Chart data generator
```

## 🎨 Customization Guide

### Change Colors
Edit `src/styles/omega.css`:
```css
:root {
  --omega-bg: #0b1020;           /* Primary background */
  --omega-surface: #0f1724;      /* Card background */
  --omega-accent: #7c3aed;       /* Brand color (purple) */
  --omega-text: #e6eef8;         /* Text color */
  --omega-muted: #9aa7bf;        /* Secondary text */
}
```

### Add Navigation Item
Edit `src/components/admin/omega-shell.tsx`:
```typescript
const navSections = [
  {
    label: "New Section",
    items: [
      { icon: Icon, label: "Item", href: "/path" }
    ]
  }
];
```

### Create New Dashboard Page
Template: `src/app/dashboard-admin-vrixo-ravi/new-page/page.tsx`
```typescript
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function NewPage() {
  await requireAdmin();
  const supabase = createAdminClient();
  
  // Fetch data here
  
  return (
    <AdminShell current="/dashboard-admin-vrixo-ravi/new-page">
      {/* Your content */}
    </AdminShell>
  );
}
```

## 📊 Data Integration Patterns

### Fetch Orders
```typescript
const { data: orders } = await supabase
  .from("orders")
  .select("id, order_number, customer_name, total, order_status, created_at")
  .order("created_at", { ascending: false })
  .limit(50);
```

### Fetch Products
```typescript
const { data: products } = await supabase
  .from("products")
  .select("id, title, price, stock, category")
  .gte("stock", 1)
  .limit(50);
```

### Fetch Analytics
```typescript
const { data: revenue } = await supabase
  .from("orders")
  .select("total")
  .gte("created_at", thirtyDaysAgo);

const total = revenue?.reduce((sum, o) => sum + o.total, 0) ?? 0;
```

## 🎯 Component Usage Examples

### StatusCard
```typescript
<StatusCard 
  href="/dashboard-admin-vrixo-ravi/orders"
  label="Total Orders"
  value="1,234"
  sub="This month"
/>
```

### AnalyticsChart
```typescript
<AnalyticsChart data={[
  { date: "2026-06-01", revenue: 50000, orders: 24 },
  { date: "2026-06-02", revenue: 62000, orders: 31 }
]} />
```

### OmegaButton
```typescript
<button className="omega-btn">
  + Add New Item
</button>
```

## 🔒 Security Checklist

- [x] All admin pages use `requireAdmin()`
- [x] Supabase RLS policies enabled
- [x] Server-side data fetching only
- [x] No API keys exposed in client code
- [x] CORS properly configured
- [x] Session validation on every request

## 🧪 Testing

### Type Check
```bash
npm run typecheck
# Should show no omega-related errors
```

### Dev Server Tests
```bash
# Navigate to:
http://localhost:3000/dashboard-admin-vrixo-ravi/          # Command Center
http://localhost:3000/dashboard-admin-vrixo-ravi/orders    # Orders page
http://localhost:3000/dashboard-admin-vrixo-ravi/products  # Products page
http://localhost:3000/dashboard-admin-vrixo-ravi/analytics # Analytics
```

### Expected Results
- ✅ All pages load in <300ms
- ✅ No console errors
- ✅ Animations smooth (60fps)
- ✅ Data displays from Supabase
- ✅ Auth redirect if not logged in

## 🐛 Common Issues & Fixes

### Chart not rendering
```
Error: "The width(-1) and height(-1) of chart should be greater than 0"
Fix: Add min-width/min-height to chart container or use aspect-ratio
```

### Auth redirect loop
```
Issue: Redirects to login even when logged in
Fix: Check NEXTAUTH_SECRET env var and session validation
```

### Styles not applying
```
Issue: CSS variables not working
Fix: Verify @import "@/styles/omega.css" in page component
```

### Data not loading
```
Issue: Empty states on all pages
Fix: Check Supabase connection and RLS policies allow read access
```

## 📈 Performance Tips

1. **Pagination**: Load 20-50 items per page (not 1000+)
2. **Lazy loading**: Use dynamic imports for heavy components
3. **Caching**: Leverage ISR for static pages (set revalidate time)
4. **Images**: Always use Next.js Image component
5. **API calls**: Batch multiple queries with Promise.all()

## 🚢 Deployment Checklist

Before deploying to production:

- [ ] Set NEXTAUTH_SECRET in production env
- [ ] Verify Supabase connection string
- [ ] Check RLS policies are correct
- [ ] Run `npm run build` successfully
- [ ] Test all auth flows
- [ ] Verify payment processing (if applicable)
- [ ] Set up error monitoring (Sentry)
- [ ] Configure CDN for static assets
- [ ] Enable HTTPS redirects
- [ ] Set rate limits on API endpoints

## 📞 Support

For issues or questions:
1. Check OMEGA_ADMIN_SYSTEM.md for architecture
2. Review component source in src/components/omega/
3. Check Supabase console for data
4. Verify .env.local has all required keys

---

**Quick Links**:
- [Design System](OMEGA_ADMIN_SYSTEM.md)
- [Next.js Docs](https://nextjs.org)
- [Supabase Docs](https://supabase.com/docs)
- [Lucide Icons](https://lucide.dev)

**Status**: Production Ready ✅
