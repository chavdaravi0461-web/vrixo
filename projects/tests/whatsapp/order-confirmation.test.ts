import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOrderTemplateComponents } from "@/lib/whatsapp";
import { calculateNextRetry } from "@/lib/notification-queue";

describe("WhatsApp order confirmation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps the approved template variables in the required order", () => {
    const components = buildOrderTemplateComponents({
      customerName: "Ravi Kumar",
      customerPhone: "9876543210",
      orderNumber: "VRX-1001",
      productNames: "Classic Watch, Leather Wallet",
      totalQty: 2,
      totalAmount: 2499,
      orderStatus: "confirmed",
      paymentMethod: "cod",
      paymentStatus: "cod_pending",
      productImageUrl: "",
      deliveryAddress: "12 MG Road, Bengaluru, Karnataka 560001"
    });

    expect(components.body.map((parameter) => parameter.text)).toEqual([
      "Ravi Kumar",
      "VRX-1001",
      "Classic Watch, Leather Wallet",
      "Cash on Delivery",
      "12 MG Road, Bengaluru, Karnataka 560001",
      "₹2,499"
    ]);
  });

  it("uses bounded exponential retry scheduling", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const now = Date.UTC(2026, 5, 7, 0, 0, 0);

    expect(calculateNextRetry(1, now)).toBe("2026-06-07T00:00:30.000Z");
    expect(calculateNextRetry(2, now)).toBe("2026-06-07T00:01:00.000Z");
    expect(calculateNextRetry(20, now)).toBe("2026-06-07T01:00:00.000Z");
  });
});
