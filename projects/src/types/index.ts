export type Category = "shoes" | "watches";

export type Product = {
  id: string;
  slug: string;
  title: string;
  category: Category;
  subcategory: string;
  brand: string;
  shortDescription: string;
  fullDescription: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  currency: string;
  stock: number;
  sku: string;
  sizes: string[];
  colors: string[];
  images: string[];
  featured: boolean;
  bestseller: boolean;
  newArrival: boolean;
  status?: "active" | "draft" | "archived";
  rating: number;
  reviewCount: number;
  specifications: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export type CartItem = {
  productId: string;
  slug: string;
  title: string;
  image: string;
  price: number;
  quantity: number;
  stock: number;
  selectedSize?: string;
  selectedColor?: string;
};

export type Address = {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  landmark?: string;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  addresses: Address[];
  role: "customer" | "admin";
  createdAt: string;
};

export type OrderStatus =
  | "Pending"
  | "Confirmed"
  | "processing"
  | "pending"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "Packed"
  | "Shipped"
  | "Delivered"
  | "Cancelled";

export type PaymentStatus =
  | "Pending"
  | "Paid"
  | "Failed"
  | "pending"
  | "paid"
  | "failed"
  | "cod_pending";
export type PaymentMethod = "Cash on Delivery" | "Online Payment" | "cod" | "online";

export type Order = {
  id: string;
  orderNumber: string;
  userId: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  shippingCharge: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  shippingAddress: Address;
  customerName: string;
  customerPhone: string;
  couponCode?: string | null;
  createdAt: string;
  updatedAt: string;
  smsStatus?: string | null;
};

export type Coupon = {
  id: string;
  code: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Review = {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  title: string;
  comment: string;
  createdAt: string;
  userName?: string;
};

export type AnalyticsSummary = {
  totalProducts: number;
  totalOrders: number;
  totalUsers: number;
  totalRevenue: number;
  lowStockCount: number;
  newContacts?: number;
  pendingOrders?: number;
  paidOrders?: number;
  codOrders?: number;
  todayOrders?: number;
  todayRevenue?: number;
  completedOrders?: number;
  activeProducts?: number;
  pendingNotifications?: number;
  failedNotifications?: number;
};
