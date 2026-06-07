import "server-only";
import { withRedis } from "@/lib/redis";

const CART_PREFIX = "cart:";
const CART_TTL = 604800; // 7 days
const GUEST_CART_PREFIX = "cart:guest:";

type CartItem = {
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

export const valkeyCart = {
  async get(userId: string): Promise<CartItem[]> {
    return withRedis(
      async (client) => {
        const raw = await client.get(`${CART_PREFIX}${userId}`);
        return raw ? (JSON.parse(raw) as CartItem[]) : [];
      },
      []
    );
  },

  async set(userId: string, items: CartItem[]): Promise<void> {
    await withRedis(
      async (client) => {
        await client.set(
          `${CART_PREFIX}${userId}`,
          JSON.stringify(items),
          "EX",
          CART_TTL
        );
      },
      undefined
    );
  },

  async addItem(userId: string, item: CartItem): Promise<CartItem[]> {
    return withRedis(
      async (client) => {
        const key = `${CART_PREFIX}${userId}`;
        const raw = await client.get(key);
        let items: CartItem[] = raw ? JSON.parse(raw) : [];

        const existing = items.find(
          (i) =>
            i.productId === item.productId &&
            i.selectedSize === item.selectedSize &&
            i.selectedColor === item.selectedColor
        );

        if (existing) {
          existing.quantity = Math.min(
            existing.quantity + item.quantity,
            item.stock
          );
        } else {
          items.push(item);
        }

        await client.set(key, JSON.stringify(items), "EX", CART_TTL);
        return items;
      },
      []
    );
  },

  async updateQuantity(
    userId: string,
    productId: string,
    quantity: number,
    size?: string,
    color?: string
  ): Promise<CartItem[]> {
    return withRedis(
      async (client) => {
        const key = `${CART_PREFIX}${userId}`;
        const raw = await client.get(key);
        if (!raw) return [];

        let items: CartItem[] = JSON.parse(raw);
        const entry = items.find(
          (i) =>
            i.productId === productId &&
            i.selectedSize === (size ?? i.selectedSize) &&
            i.selectedColor === (color ?? i.selectedColor)
        );

        if (entry) {
          entry.quantity = Math.max(1, Math.min(quantity, entry.stock));
        }

        await client.set(key, JSON.stringify(items), "EX", CART_TTL);
        return items;
      },
      []
    );
  },

  async removeItem(
    userId: string,
    productId: string,
    size?: string,
    color?: string
  ): Promise<CartItem[]> {
    return withRedis(
      async (client) => {
        const key = `${CART_PREFIX}${userId}`;
        const raw = await client.get(key);
        if (!raw) return [];

        let items: CartItem[] = JSON.parse(raw);
        items = items.filter(
          (i) =>
            !(
              i.productId === productId &&
              i.selectedSize === (size ?? i.selectedSize) &&
              i.selectedColor === (color ?? i.selectedColor)
            )
        );

        await client.set(key, JSON.stringify(items), "EX", CART_TTL);
        return items;
      },
      []
    );
  },

  async clear(userId: string): Promise<void> {
    await withRedis(
      async (client) => {
        await client.del(`${CART_PREFIX}${userId}`);
      },
      undefined
    );
  },

  async mergeCarts(guestId: string, userId: string): Promise<CartItem[]> {
    return withRedis(
      async (client) => {
        const guestKey = `${GUEST_CART_PREFIX}${guestId}`;
        const userKey = `${CART_PREFIX}${userId}`;

        const [guestRaw, userRaw] = await Promise.all([
          client.get(guestKey),
          client.get(userKey),
        ]);

        const guestItems: CartItem[] = guestRaw ? JSON.parse(guestRaw) : [];
        const userItems: CartItem[] = userRaw ? JSON.parse(userRaw) : [];

        for (const guestItem of guestItems) {
          const existing = userItems.find(
            (i) =>
              i.productId === guestItem.productId &&
              i.selectedSize === guestItem.selectedSize &&
              i.selectedColor === guestItem.selectedColor
          );

          if (existing) {
            existing.quantity = Math.min(
              existing.quantity + guestItem.quantity,
              existing.stock
            );
          } else {
            userItems.push(guestItem);
          }
        }

        const multi = client.multi();
        multi.set(userKey, JSON.stringify(userItems), "EX", CART_TTL);
        multi.del(guestKey);
        await multi.exec();

        return userItems;
      },
      []
    );
  },

  async getGuestCart(guestId: string): Promise<CartItem[]> {
    return withRedis(
      async (client) => {
        const raw = await client.get(`${GUEST_CART_PREFIX}${guestId}`);
        return raw ? (JSON.parse(raw) as CartItem[]) : [];
      },
      []
    );
  },

  async setGuestCart(guestId: string, items: CartItem[]): Promise<void> {
    await withRedis(
      async (client) => {
        const ttl = process.env.NODE_ENV === "production" ? 86400 : 86400 * 7;
        await client.set(
          `${GUEST_CART_PREFIX}${guestId}`,
          JSON.stringify(items),
          "EX",
          ttl
        );
      },
      undefined
    );
  },
};
