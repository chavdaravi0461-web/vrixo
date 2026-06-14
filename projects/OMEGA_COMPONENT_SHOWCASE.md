# 🎨 Omega Admin Panel - Component Showcase

## Live Component Examples

### 1. StatusCard Component
**Location**: `src/components/omega/status-card.tsx`

#### Basic Usage
```tsx
<StatusCard
  href="/dashboard-admin-vrixo-ravi/orders"
  icon={ShoppingCart}
  label="Order Queue"
  value="24"
  sub="Pending fulfillment"
  tone="sky"
/>
```

#### Tone Variants
```tsx
// Emerald (Green)
<StatusCard tone="emerald" label="Revenue" value="₹1.2M" />

// Sky (Blue)
<StatusCard tone="sky" label="Orders" value="245" />

// Violet (Purple)
<StatusCard tone="violet" label="Customers" value="3,420" />

// Amber (Yellow)
<StatusCard tone="amber" label="Alerts" value="12" />
```

**Visual Result**:
```
┌─────────────────────────┐
│ 📊 Order Queue          │
│                         │
│ 24                      │
│ Pending fulfillment     │
└─────────────────────────┘
```

---

### 2. AnalyticsChart Component
**Location**: `src/components/omega/analytics-chart.tsx`

#### Basic Usage
```tsx
const data = [
  { date: "2026-06-01", revenue: 45000, orders: 18 },
  { date: "2026-06-02", revenue: 62000, orders: 31 },
  { date: "2026-06-03", revenue: 58000, orders: 25 },
];

<AnalyticsChart data={data} />
```

#### Features
- Interactive line chart
- Revenue vs Orders toggle buttons
- Responsive sizing
- Recharts integration
- Hover tooltips
- Legend display

**Visual Result**:
```
┌────────────────────────────────┐
│ Revenue Trend (14 Days)        │
│                                │
│ 80K │         ╱╲              │
│ 60K │    ╱╲  ╱  ╲  ╱╲         │
│ 40K │   ╱  ╲╱    ╲╱  ╲       │
│ 20K │  ╱                    │
│      └───────────────────────  │
│ [📊 Revenue]  [📈 Orders]     │
└────────────────────────────────┘
```

---

### 3. OmegaButton Component
**Location**: `src/components/omega/button.tsx`

#### Text Button
```tsx
<button className="omega-btn">
  + Add New Product
</button>
```

#### Icon Button
```tsx
<button className="omega-icon-btn">
  <Search size={16} />
</button>
```

**Visual Result**:
```
Text Button:
┌──────────────────────┐
│  + Add New Product   │
└──────────────────────┘

Icon Button:
┌──┐
│ 🔍 │
└──┘
```

---

### 4. OmegaCard Component
**Location**: `src/components/omega/card.tsx`

#### Basic Usage
```tsx
<div className="omega-card">
  <h3>Card Title</h3>
  <p>Card content goes here</p>
</div>
```

**Features**:
- Glass morphism effect
- Gradient background
- Semi-transparent borders
- Smooth hover transitions

**Visual Result**:
```
┌──────────────────────┐
│ Card Title           │
│                      │
│ Card content goes    │
│ here with glass      │
│ morphism effect      │
└──────────────────────┘
```

---

### 5. OmegaHeader Component
**Location**: `src/components/omega/header.tsx`

#### Features
```tsx
<header className="omega-header">
  <div className="omega-brand">
    <Logo />
    <span>Vrixo Omega</span>
  </div>
  
  <div className="omega-search">
    <Search size={16} />
    <input placeholder="Search..." />
  </div>
  
  <div className="omega-actions">
    <button>Alerts</button>
    <button>User Menu</button>
  </div>
</header>
```

**Visual Result**:
```
┌──────────────────────────────────────────────┐
│ 🔷 Vrixo Omega │ 🔍 Search... │ 🔔 👤 │
└──────────────────────────────────────────────┘
```

---

### 6. OmegaSidebar Component
**Location**: `src/components/omega/sidebar.tsx`

#### Navigation Structure
```tsx
const navSections = [
  {
    label: "Command",
    items: [
      { icon: Zap, label: "Dashboard", href: "/" },
      { icon: Search, label: "Search", href: "/search" },
    ]
  },
  {
    label: "Commerce",
    items: [
      { icon: ShoppingCart, label: "Orders", href: "/orders" },
      { icon: Package, label: "Products", href: "/products" },
    ]
  },
  {
    label: "Operations",
    items: [
      { icon: TrendingUp, label: "Analytics", href: "/analytics" },
      { icon: Settings, label: "Settings", href: "/settings" },
    ]
  },
];
```

**Visual Result**:
```
┌──────────────┐
│ Command      │
│ ⚡ Dashboard │
│ 🔍 Search   │
│              │
│ Commerce     │
│ 🛒 Orders   │
│ 📦 Products │
│              │
│ Operations   │
│ 📈 Analytics│
│ ⚙️ Settings │
└──────────────┘
```

---

### 7. OmegaModal Component
**Location**: `src/components/omega/modal.tsx`

#### Basic Usage
```tsx
{isOpen && (
  <Modal onClose={() => setIsOpen(false)}>
    <h2>Modal Title</h2>
    <p>Modal content here</p>
    <button onClick={() => setIsOpen(false)}>Close</button>
  </Modal>
)}
```

**Features**:
- Backdrop overlay with blur
- Centered modal box
- Slide-up animation
- Click outside to close
- Proper z-index stacking

**Visual Result**:
```
┌─────────────────────────────────┐
│ ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  · │
│ ·                               · │
│ ·  ┌─────────────────────────┐  · │
│ ·  │ Modal Title             │  · │
│ ·  │                         │  · │
│ ·  │ Modal content here      │  · │
│ ·  │                         │  · │
│ ·  │ [Close]                 │  · │
│ ·  └─────────────────────────┘  · │
│ ·                               · │
│ ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  · │
└─────────────────────────────────┘
```

---

### 8. OmegaShell Component
**Location**: `src/components/admin/omega-shell.tsx`

#### Complete Layout
```tsx
<AdminShell current="/dashboard-admin-vrixo-ravi">
  {/* Renders: */}
  {/* 1. Header with search, alerts, user menu */}
  {/* 2. Sidebar with navigation */}
  {/* 3. Your content here */}
</AdminShell>
```

**Features**:
- Top header bar
- Left sidebar
- Main content area
- Command palette (Cmd+K)
- System health monitor
- Error boundary
- Keyboard shortcuts

**Visual Result**:
```
┌────────────────────────────────────┐
│ 🔷 Logo │ 🔍 Search │ 🔔 👤      │
├──────────┬────────────────────────┤
│ Command  │                        │
│ ⚡ Dash  │  Your Page Content    │
│ 🔍 Srch  │  Renders Here        │
│          │                        │
│ Commerce │                        │
│ 🛒 Ord   │  With sidebar on left │
│ 📦 Prod  │  and header on top    │
│          │                        │
│ Ops      │                        │
│ 📈 Anal  │                        │
│ ⚙️ Set   │                        │
└──────────┴────────────────────────┘
```

---

## 🎨 Design System Colors

### Base Colors
```css
--omega-bg: #0b1020;         /* Deep space black */
--omega-surface: #0f1724;    /* Card background */
--omega-accent: #7c3aed;     /* Vibrant purple */
--omega-text: #e6eef8;       /* Bright white */
--omega-muted: #9aa7bf;      /* Secondary text */
--omega-radius: 10px;        /* Border radius */
```

### Tone Variants (StatusCard)
```
Emerald:  rgba(34, 197, 94, 0.3)      [Green - Revenue]
Sky:      rgba(59, 130, 246, 0.3)     [Blue - Orders]
Violet:   rgba(124, 58, 237, 0.3)     [Purple - Metrics]
Amber:    rgba(245, 158, 11, 0.3)     [Yellow - Alerts]
```

### Alert/Status Colors
```
Success:  rgba(34, 197, 94, x)        [Green - Good]
Warning:  rgba(245, 158, 11, x)       [Yellow - Caution]
Error:    rgba(239, 68, 68, x)        [Red - Bad]
Info:     rgba(59, 130, 246, x)       [Blue - Info]
```

---

## ⚡ Animations

### Fade In (200ms)
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```
**Used for**: Modals, overlays, page transitions

### Slide Up (200ms)
```css
@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(8px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}
```
**Used for**: Modal entrance, card reveals

### Spin (2s continuous)
```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```
**Used for**: Loading indicators, brand icon

### Hover Scale
```css
transform: translateY(-2px);
```
**Used for**: Cards, buttons on hover

---

## 📱 Responsive Breakpoints

```css
/* Mobile First */
display: grid;
gridTemplateColumns: "1fr";  /* Mobile: single column */

/* Tablet (768px+) */
@media (min-width: 768px) {
  gridTemplateColumns: "1fr 1fr";
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  gridTemplateColumns: "1fr 1fr 1fr 1fr";
}
```

---

## 🔧 Customization Examples

### Change Accent Color
```css
/* In omega.css */
:root {
  --omega-accent: #ec4899;  /* Pink instead of purple */
}
```

### Add New Tone Variant
```tsx
// In status-card.tsx, add:
if (tone === "rose") {
  styles.background = "rgba(244, 63, 94, 0.1)";
  styles.color = "rgb(244, 63, 94)";
}
```

### Customize Header Height
```css
.omega-header {
  height: 70px;  /* Default is 60px */
  padding: 16px 20px;
}
```

---

## 🧪 Testing Components

### Visual Testing
```bash
# Start dev server
npm run dev

# Visit showcase page
http://localhost:3000/dashboard-admin-vrixo-ravi/omega-demo
```

### Component Props Testing
```typescript
// StatusCard with all props
<StatusCard
  href="/test"
  icon={Package}
  label="Test Metric"
  value="999"
  sub="Test subtitle"
  tone="emerald"
/>

// AnalyticsChart with sample data
<AnalyticsChart data={makeDailyRevenue(30)} />

// OmegaButton variations
<button className="omega-btn">Standard Button</button>
<button className="omega-icon-btn"><Search /></button>
```

---

## 📚 Component API Summary

| Component | Location | Props | Features |
|-----------|----------|-------|----------|
| StatusCard | omega/status-card.tsx | href, icon, label, value, sub, tone | KPI metric display |
| AnalyticsChart | omega/analytics-chart.tsx | data | Interactive chart |
| OmegaButton | omega/button.tsx | children, className | Text/icon button |
| OmegaCard | omega/card.tsx | children, className | Glass card wrapper |
| OmegaHeader | omega/header.tsx | title | Top navigation |
| OmegaSidebar | omega/sidebar.tsx | current | Left sidebar nav |
| OmegaModal | omega/modal.tsx | children, onClose | Modal overlay |
| OmegaShell | admin/omega-shell.tsx | current, children | Premium shell |

---

## 💡 Best Practices

1. **Always wrap components in AdminShell** for consistent layout
2. **Use StatusCard for KPIs** - not generic divs
3. **Prefer AnalyticsChart for time-series data** - built for it
4. **Keep animations consistent** - use standard durations (150-200ms)
5. **Maintain color consistency** - use tone variants
6. **Mobile-first approach** - design for small screens first
7. **Type everything** - TypeScript catches errors early
8. **Server-side data** - fetch in page.tsx, pass to components

---

**Last Updated**: 2026-06-11  
**Omega Version**: 1.0.0  
**Status**: Production Ready ✨
