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
  highlighted: boolean;
  displaySections?: import("@/lib/product-display").ProductDisplaySection[];
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

export type OrderState =
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "return_requested"
  | "return_approved"
  | "return_pickup_scheduled"
  | "return_received"
  | "refund_processed"
  | "completed";

export const ORDER_LIFECYCLE: Record<OrderState, { label: string; allowedTransitions: OrderState[]; cancellable: boolean; returnable: boolean }> = {
  pending:             { label: "Pending",             allowedTransitions: ["confirmed", "cancelled"],                               cancellable: true,  returnable: false },
  confirmed:           { label: "Confirmed",           allowedTransitions: ["processing", "cancelled"],                              cancellable: true,  returnable: false },
  processing:          { label: "Processing",          allowedTransitions: ["packed", "cancelled"],                                  cancellable: false, returnable: false },
  packed:              { label: "Packed",              allowedTransitions: ["shipped", "cancelled"],                                 cancellable: false, returnable: false },
  shipped:             { label: "Shipped",             allowedTransitions: ["delivered"],                                             cancellable: false, returnable: false },
  delivered:           { label: "Delivered",           allowedTransitions: ["return_requested", "completed"],                         cancellable: false, returnable: true },
  cancelled:           { label: "Cancelled",           allowedTransitions: [],                                                        cancellable: false, returnable: false },
  return_requested:    { label: "Return Requested",    allowedTransitions: ["return_approved", "return_received", "cancelled"],       cancellable: false, returnable: false },
  return_approved:     { label: "Return Approved",     allowedTransitions: ["return_pickup_scheduled", "return_received", "cancelled"], cancellable: false, returnable: false },
  return_pickup_scheduled: { label: "Pickup Scheduled", allowedTransitions: ["return_received", "cancelled"],                        cancellable: false, returnable: false },
  return_received:     { label: "Return Received",     allowedTransitions: ["refund_processed"],                                     cancellable: false, returnable: false },
  refund_processed:    { label: "Refund Processed",    allowedTransitions: ["completed"],                                             cancellable: false, returnable: false },
  completed:           { label: "Completed",           allowedTransitions: [],                                                        cancellable: false, returnable: false },
};

export type SupportTicket = {
  id: string;
  ticketNumber: string;
  userId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  subject: string;
  description: string;
  category: "order" | "payment" | "shipping" | "product" | "return" | "cancellation" | "account" | "general" | "complaint" | "other";
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting_on_customer" | "waiting_on_admin" | "resolved" | "closed";
  assignedTo: string | null;
  source: "web" | "whatsapp" | "email" | "phone" | "admin";
  orderId: string | null;
  orderNumber: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketReply = {
  id: string;
  ticketId: string;
  userId: string | null;
  authorName: string;
  authorRole: "customer" | "admin" | "system";
  isAdmin: boolean;
  message: string;
  attachments: Array<{ url: string; name: string }>;
  internalNote: boolean;
  createdAt: string;
};

export type ReturnRequest = {
  id: string;
  orderId: string;
  orderNumber: string;
  userId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  reason: string;
  details: string | null;
  status: "pending" | "approved" | "rejected" | "pickup_scheduled" | "pickup_done" | "item_received" | "refund_processed" | "completed" | "cancelled";
  items: Array<{ title: string; quantity: number; price: number }>;
  pickupAddress: Record<string, unknown> | null;
  pickupDate: string | null;
  courier: string | null;
  trackingNumber: string | null;
  adminNotes: string | null;
  refundAmount: number | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderStatusLog = {
  id: string;
  orderId: string;
  fromStatus: string;
  toStatus: string;
  changedBy: string;
  changedById: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
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
