# VRIXO WhatsApp Automation - Complete System Guide

## Overview

The VRIXO platform now features **fully automatic WhatsApp order confirmation delivery**. When a customer completes an order, WhatsApp messages are sent automatically **without any manual action from the customer or support team**.

### User Flow (Customer Perspective)
```
1. Customer places order
   ↓
2. Order confirmation page shown
   ↓
3. ✅ "Order details sent to WhatsApp automatically" message appears
   ↓
4. Customer receives WhatsApp message with order details + product image
   ↓
5. Admin team notified of successful delivery
```

### What Customer Receives
- 📸 **Product Image** with order confirmation caption
- 🔥 "VRIXO ORDER CONFIRMED" message with:
  - Customer name greeting
  - Product details (name, price, quantity)
  - Order ID and delivery timeline
  - Delivery address
  - Thank you message with support instructions

**No manual button clicks. No wa.me links. No customer action required.**

---

## Architecture

### 1. Order Creation Endpoints

#### **COD (Cash on Delivery)**
- **Route**: `POST /api/orders`
- **Triggers**: COD order creation
- **WhatsApp Dispatch**: Automatic via `sendOrderSmsAndPersistStatus()`
- **Flow**:
  1. Order created in database
  2. `sendOrderSmsAndPersistStatus()` called with order details
  3. SMS and WhatsApp notifications queued
  4. Notifications dispatched immediately
  5. Retry scheduling if failed

#### **Online Payment (Razorpay)**
- **Route**: `POST /api/payments/razorpay/verify`
- **Triggers**: Payment verification + order confirmation
- **WhatsApp Dispatch**: Automatic via `sendOrderSmsAndPersistStatus()`
- **Flow**:
  1. Payment signature verified
  2. Order marked as paid
  3. `sendOrderSmsAndPersistStatus()` called
  4. SMS and WhatsApp notifications queued
  5. Notifications dispatched immediately
  6. Payment success page shows WhatsApp status

---

## System Components

### **1. Core WhatsApp Functions** (`src/lib/whatsapp.ts`)

#### `sendOrderConfirmationWhatsApp(payload)`
Main function that orchestrates WhatsApp delivery:
- Formats customer phone number
- Validates WhatsApp environment
- Sends product image with caption to customer
- Sends success notification to admin
- Returns delivery status with error details

```typescript
type WhatsAppCustomerPayload = {
  customerName: string;
  customerPhone: string;
  orderNumber: string;
  productNames: string;
  totalQty: number;
  totalAmount: number;
  orderStatus: string;
  productImageUrl: string;
  deliveryAddress: string;
};

const result = await sendOrderConfirmationWhatsApp(payload);
// Returns: { sent: boolean, error: string | null, adminNotified: boolean }
```

#### `buildOrderWhatsAppCaption(payload)`
Formats the message with proper emoji branding:
```
🔥 VRIXO ORDER CONFIRMED 🔥

👤 Hello [Customer Name]

✅ Your order has been confirmed.

🛍 Product: [Product Name]
💸 Price: ₹[Amount]
🧾 Quantity: [Qty]
🆔 Order ID: [Order Number]

🚚 Delivery updates will be shared soon.

📍 Delivery: [Address]

Thank you for shopping with VRIXO ❤️
```

#### `sendWhatsAppImageMessage()` & `sendWhatsAppTextMessage()`
Low-level WhatsApp Cloud API wrappers:
- `sendWhatsAppImageMessage()` - Sends image with caption (used for product photo)
- `sendWhatsAppTextMessage()` - Sends text-only message (used for admin alerts)
- Both use WhatsApp Cloud API v17.0

### **2. Notification Queue** (`src/lib/notification-queue.ts`)

The notification queue provides **retryable, persistent message delivery**:

#### Key Functions:
- `createOrderNotification()` - Creates queue entry in database
- `dispatchOrderNotification()` - Sends message immediately
- `processPendingNotifications()` - Processes retries (called by worker)
- `calculateNextRetry()` - Exponential backoff: 10min → 20min → 40min → 80min → 160min

#### Database Tables:
- `order_notifications` - Queue entries (status, retry schedule)
- `order_notification_attempts` - Attempt history and error logs

#### Retry Logic:
```
Attempt 1: Immediate send
Attempt 2: 10 min delay
Attempt 3: 20 min delay
Attempt 4: 40 min delay
Attempt 5: 80 min delay
Attempt 6: Failed (max 5 attempts)
```

### **3. Order Response Integration**

Both order creation endpoints return WhatsApp status:

```typescript
{
  orderId: string;
  orderNumber: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  smsSent: boolean;
  whatsappSent: boolean;  // ← Frontend receives this
}
```

### **4. Order Success Page** (`src/app/(store)/order-success/[orderNumber]/page.tsx`)

Displays WhatsApp delivery status automatically:

```
✅ Order details sent to WhatsApp automatically.
   (Green success message when whatsapp_status = "sent")

OR

⏳ WhatsApp delivery is being processed. You'll receive details shortly.
   (Amber pending message when whatsapp_status = "pending")
```

---

## Environment Configuration

### Required Environment Variables

```env
# WhatsApp Cloud API
WHATSAPP_CLOUD_API_TOKEN=<Bearer Token from Meta Business Account>
WHATSAPP_PHONE_NUMBER_ID=<Phone Number ID from WhatsApp Manager>
WHATSAPP_ADMIN_NUMBER=91XXXXXXXXXX  # Admin phone to receive notifications
```

### Obtaining Credentials

1. **Phone Number ID**
   - Go to Meta Business Suite → WhatsApp Manager
   - Select your WhatsApp Business Account
   - Navigate to "Phone Numbers"
   - Copy the Phone Number ID (usually starts with digits)

2. **Bearer Token**
   - Go to System User settings in Meta Business Account
   - Create/select system user
   - Generate permanent access token
   - Ensure token has "whatsapp_business_messaging" permission

3. **Admin Number**
   - Your personal WhatsApp number to receive order notifications
   - Format: 91 (country code) + 10-digit number

---

## Database Schema

### `order_notifications` Table
```sql
CREATE TABLE order_notifications (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  provider VARCHAR(20), -- "sms" or "whatsapp"
  event_type VARCHAR(50), -- "order_confirmation"
  status VARCHAR(20), -- "pending", "sent", "failed", "retry_scheduled"
  attempts INTEGER,
  max_attempts INTEGER DEFAULT 5,
  payload JSONB,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE order_notification_attempts (
  id UUID PRIMARY KEY,
  notification_id UUID NOT NULL,
  provider VARCHAR(20),
  event_type VARCHAR(50),
  attempt INTEGER,
  status VARCHAR(20),
  error TEXT,
  response JSONB,
  created_at TIMESTAMPTZ
);
```

---

## How to Monitor Delivery

### Admin Dashboard
- Navigate to Admin Dashboard
- View "Notifications" section with:
  - Pending notifications count
  - Failed notifications count
  - Recent notification attempt logs

### Database Query
```sql
-- Check WhatsApp delivery status for specific order
SELECT 
  order_number,
  whatsapp_status,
  whatsapp_error,
  updated_at
FROM orders
WHERE order_number = 'DC-260507-ABC123';

-- Check retry schedule
SELECT 
  on.id,
  on.order_id,
  on.attempts,
  on.status,
  on.next_retry_at,
  on.last_error
FROM order_notifications on
WHERE on.provider = 'whatsapp'
  AND on.status IN ('pending', 'retry_scheduled')
ORDER BY on.next_retry_at ASC;
```

---

## Testing the System

### Test 1: Verify Environment
```typescript
// Test in /api/test endpoint
import { hasWhatsAppServerEnv } from '@/lib/whatsapp';

const hasEnv = hasWhatsAppServerEnv();
console.log('WhatsApp configured:', hasEnv);
```

### Test 2: Send Test Message
```typescript
import { sendOrderConfirmationWhatsApp } from '@/lib/whatsapp';

const result = await sendOrderConfirmationWhatsApp({
  customerName: 'Test User',
  customerPhone: '9199999999',  // Your test number
  orderNumber: 'TEST-001',
  productNames: 'Test Product',
  totalQty: 1,
  totalAmount: 500,
  orderStatus: 'confirmed',
  productImageUrl: 'https://via.placeholder.com/1080x1080.png',
  deliveryAddress: 'Test Address'
});

console.log('WhatsApp result:', result);
```

### Test 3: End-to-End Order Flow
1. Create test order via `/api/orders` (COD)
2. Check response: `whatsappSent` should be `true`
3. Verify message received on test phone
4. Check admin notification
5. Verify database entries in `order_notifications`

---

## Removed Components

### ❌ Manual WhatsApp Button
- **File**: `src/components/store/whatsapp-order-button.tsx` (DELETED)
- **Reason**: No longer needed - automatic delivery replaces manual clicks
- **wa.me Links**: All removed from codebase

### ✅ Replaced With
- Automatic status message on order success page
- `whatsapp_status` field in order response
- Queue-based retry system for reliability

---

## Error Handling & Recovery

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| WhatsApp not sent | Missing WHATSAPP_CLOUD_API_TOKEN | Verify .env has valid token |
| Delivery failed after 5 attempts | Invalid customer phone number | Check phone number format (91XXXXXXXXXX) |
| Admin not notified | WHATSAPP_ADMIN_NUMBER missing | Add admin number to .env |
| Messages delayed | Queue processor not running | Verify Render worker task is active |
| Image not loading | Invalid product image URL | Ensure image URL is publicly accessible |

### Retry Behavior
- Automatic exponential backoff: 10min → 20min → 40min → 80min → 160min
- Max 5 attempts before marking as failed
- Admin receives notification on failure
- Order marked as `whatsapp_status = "failed"` after max attempts
- Manual resend not needed - customer can contact support

---

## Production Deployment Checklist

- [ ] WhatsApp environment variables set in Vercel
- [ ] WhatsApp Phone Number ID configured
- [ ] Bearer token with proper permissions set
- [ ] Admin phone number configured (receives test messages)
- [ ] Render worker task running for notification queue
- [ ] Database migrations applied (order_notifications tables)
- [ ] Order success page displays correctly
- [ ] Test COD order - verify automatic WhatsApp received
- [ ] Test online payment order - verify automatic WhatsApp received
- [ ] Admin notifications working
- [ ] Dashboard showing notification metrics

---

## API Response Examples

### Successful Order Creation (COD)
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "orderNumber": "DC-250507-ABC123",
  "paymentMethod": "cod",
  "paymentStatus": "cod_pending",
  "orderStatus": "pending",
  "shippingCharge": 50,
  "total": 1250,
  "smsSent": true,
  "whatsappSent": true
}
```

### Successful Payment Verification (Online)
```json
{
  "orderId": "660e8400-e29b-41d4-a716-446655440000",
  "orderNumber": "DC-250507-DEF456",
  "paymentMethod": "online",
  "paymentStatus": "paid",
  "orderStatus": "Confirmed",
  "smsSent": true,
  "whatsappSent": true
}
```

---

## FAQ

**Q: What if customer number is invalid?**
A: System detects invalid format, notifies admin, returns error in queue. No retry attempted.

**Q: Can customers opt-out of WhatsApp?**
A: Currently not implemented. To add opt-out: add `whatsapp_opt_out` field to users table and check before sending.

**Q: How long does delivery take?**
A: Typically <5 seconds. Delayed delivery (5+ mins) indicates API issues. Check admin notifications.

**Q: What if WhatsApp API is down?**
A: Message queued with retry. Retries every 10+ minutes until delivered or max attempts exceeded.

**Q: Can I resend a message manually?**
A: Via database: Update `order_notifications` set `status = 'pending', next_retry_at = now()` for that notification ID.

---

## Support & Monitoring

- **Logs**: Check `netlify/functions/` logs for worker task errors
- **Dashboard**: Admin dashboard shows pending/failed notifications
- **Database**: Query `order_notifications` for detailed attempt history
- **Admin Alerts**: Admin receives WhatsApp notifications for failed deliveries

---

**Last Updated**: 2025-05-10  
**Version**: 1.0 - Full Automation  
**Status**: ✅ Production Ready
