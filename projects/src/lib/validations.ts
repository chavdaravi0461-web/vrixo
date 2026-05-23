import { z } from "zod";

export const authSchema = z.object({
  name: z.string().min(2, "Enter your full name.").optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  phone: z.string().min(10, "Enter a valid phone number.").optional()
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or mobile number."),
  password: z.string().min(6, "Password must be at least 6 characters.")
});

export const customerOtpAuthSchema = z.object({
  name: z.string().trim().optional(),
  phone: z
    .string()
    .trim()
    .min(10, "Enter a valid Indian mobile number."),
  otp: z.string().trim().optional()
});

export const addressSchema = z.object({
  fullName: z.string().min(2, "Full name is required."),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian phone number."),
  line1: z.string().min(5, "Address line 1 is required."),
  line2: z.string().optional(),
  city: z.string().min(2, "City is required."),
  state: z.string().min(2, "State is required."),
  postalCode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
  country: z.string().min(2, "Country is required."),
  landmark: z.string().optional()
});

export const checkoutSchema = addressSchema.extend({
  email: z.email("Valid email is required."),
  couponCode: z.string().optional(),
  paymentMethod: z.enum(["Cash on Delivery", "Online Payment"], {
    error: "Select a payment method."
  })
});

export const contactSchema = z.object({
  name: z.string().min(2, "Name is required."),
  email: z.email("Valid email is required."),
  phone: z.string().min(10, "Valid phone number is required."),
  subject: z.string().min(3, "Subject is required."),
  message: z.string().min(10, "Message is required.")
});

export const couponSchema = z.object({
  code: z.string().min(3),
  description: z.string().min(3),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.coerce.number().positive(),
  minOrderAmount: z.coerce.number().min(0),
  active: z.boolean().default(true)
});
