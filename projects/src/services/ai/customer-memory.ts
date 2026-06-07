import { withRedis } from "@/lib/redis";

type CustomerMemoryRecord = {
  customerId: string;
  email?: string;
  phone?: string;
  shoppingPreferences?: {
    favoriteCategories?: string[];
    brandAffinity?: Record<string, number>;
    sizeHistory?: Record<string, number>;
    colorPreferences?: string[];
    priceRange?: { min?: number; max?: number };
    preferredDeliverySpeed?: string;
  };
  purchaseHistory?: {
    totalPurchases?: number;
    totalSpent?: number;
    averageOrderValue?: number;
    lastPurchaseDate?: string | Date;
    categoryFrequency?: Record<string, number>;
  };
  behaviorMetrics?: {
    browsingFrequency?: number;
    conversionRate?: number;
    cartAbandonmentRate?: number;
    returnRate?: number;
    reviewsGiven?: number;
  };
  lifetime?: {
    customerSegment?: string;
    ltv?: number;
    predictedChurnRisk?: number;
    engagementScore?: number;
    npsScore?: number;
  };
  personalizationVectors?: {
    embeddings?: number[];
    seasonalPreferences?: Record<string, number>;
    dayOfWeekBias?: Record<string, number>;
  };
  lastUpdated?: string;
};

const CUSTOMER_MEMORY_INDEX = "customer-memory:index";

export async function upsertCustomerMemory(customerId: string, updates: Partial<CustomerMemoryRecord>) {
  const existing = await getCustomerMemory(customerId);
  const next: CustomerMemoryRecord = {
    ...(existing ?? { customerId }),
    ...updates,
    customerId,
    shoppingPreferences: {
      ...(existing?.shoppingPreferences ?? {}),
      ...(updates.shoppingPreferences ?? {})
    },
    purchaseHistory: {
      ...(existing?.purchaseHistory ?? {}),
      ...(updates.purchaseHistory ?? {})
    },
    behaviorMetrics: {
      ...(existing?.behaviorMetrics ?? {}),
      ...(updates.behaviorMetrics ?? {})
    },
    lifetime: {
      ...(existing?.lifetime ?? {}),
      ...(updates.lifetime ?? {})
    },
    personalizationVectors: {
      ...(existing?.personalizationVectors ?? {}),
      ...(updates.personalizationVectors ?? {})
    },
    lastUpdated: new Date().toISOString()
  };

  await withRedis(async (redis) => {
    await redis.hset(CUSTOMER_MEMORY_INDEX, customerId, JSON.stringify(next));
    return true;
  }, false);

  return next;
}

export async function getCustomerMemory(customerId: string): Promise<CustomerMemoryRecord | null> {
  return withRedis(async (redis) => {
    const value = await redis.hget(CUSTOMER_MEMORY_INDEX, customerId);
    return value ? (JSON.parse(value) as CustomerMemoryRecord) : null;
  }, null);
}

export async function recordPurchase(customerId: string, orderData: {
  amount: number;
  categories: string[];
  items: Array<{ title: string; category: string; size?: string; color?: string }>;
}) {
  const memory = await getCustomerMemory(customerId);

  if (!memory) {
    return upsertCustomerMemory(customerId, {
      purchaseHistory: {
        totalPurchases: 1,
        totalSpent: orderData.amount,
        averageOrderValue: orderData.amount,
        lastPurchaseDate: new Date().toISOString(),
        categoryFrequency: Object.fromEntries(orderData.categories.map((category) => [category, 1]))
      },
      lifetime: {
        customerSegment: "new",
        ltv: orderData.amount,
        engagementScore: 50
      }
    });
  }

  const newTotalPurchases = Number(memory.purchaseHistory?.totalPurchases ?? 0) + 1;
  const newTotalSpent = Number(memory.purchaseHistory?.totalSpent ?? 0) + orderData.amount;
  const sizeMap = new Map<string, number>(Object.entries(memory.shoppingPreferences?.sizeHistory ?? {}));
  const colorSet = new Set(memory.shoppingPreferences?.colorPreferences || []);
  const categoryMap = new Map<string, number>(Object.entries(memory.purchaseHistory?.categoryFrequency ?? {}));

  for (const item of orderData.items) {
    if (item.size) sizeMap.set(item.size, (sizeMap.get(item.size) || 0) + 1);
    if (item.color) colorSet.add(item.color);
  }

  for (const category of orderData.categories) {
    categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
  }

  let segment = "loyal";
  if (newTotalPurchases === 1) segment = "new";
  else if (newTotalPurchases >= 10 || newTotalSpent > 50000) segment = "vip";
  else if (newTotalPurchases < 3) segment = "occasional";

  return upsertCustomerMemory(customerId, {
    purchaseHistory: {
      totalPurchases: newTotalPurchases,
      totalSpent: newTotalSpent,
      averageOrderValue: newTotalSpent / newTotalPurchases,
      lastPurchaseDate: new Date().toISOString(),
      categoryFrequency: Object.fromEntries(categoryMap)
    },
    shoppingPreferences: {
      sizeHistory: Object.fromEntries(sizeMap),
      colorPreferences: Array.from(colorSet)
    },
    lifetime: {
      customerSegment: segment,
      ltv: newTotalSpent,
      engagementScore: Math.min(100, 50 + newTotalPurchases * 5)
    }
  });
}

export async function recordBrowsingSession(customerId: string, categories: string[], duration: number) {
  void duration;
  const memory = await getCustomerMemory(customerId);
  const categorySet = new Set(memory?.shoppingPreferences?.favoriteCategories || []);
  categories.forEach((category) => categorySet.add(category));

  return upsertCustomerMemory(customerId, {
    behaviorMetrics: {
      browsingFrequency: Number(memory?.behaviorMetrics?.browsingFrequency ?? 0) + 1
    },
    shoppingPreferences: {
      favoriteCategories: Array.from(categorySet).slice(0, 5)
    }
  });
}

export async function calculateChurnRisk(customerId: string): Promise<number> {
  const memory = await getCustomerMemory(customerId);
  if (!memory) return 0;

  let riskScore = 0;
  const daysSinceLastPurchase = memory.purchaseHistory?.lastPurchaseDate
    ? Math.floor((Date.now() - new Date(memory.purchaseHistory.lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  if (daysSinceLastPurchase > 90) riskScore += 40;
  else if (daysSinceLastPurchase > 60) riskScore += 25;
  else if (daysSinceLastPurchase > 30) riskScore += 10;

  if ((memory.behaviorMetrics?.returnRate ?? 0) > 0.3) riskScore += 20;
  if ((memory.lifetime?.engagementScore ?? 0) < 30) riskScore += 15;
  if ((memory.behaviorMetrics?.cartAbandonmentRate ?? 0) > 0.5) riskScore += 15;

  return Math.min(100, riskScore);
}

export async function getTopSegmentCustomers(segment: string, limit = 100) {
  const rows = await getAllCustomerMemory();
  return rows
    .filter((memory) => memory.lifetime?.customerSegment === segment)
    .sort((a, b) => Number(b.lifetime?.ltv ?? 0) - Number(a.lifetime?.ltv ?? 0))
    .slice(0, limit);
}

export async function getAtRiskCustomers(limit = 50) {
  const rows = await getAllCustomerMemory();
  return rows
    .filter((memory) => Number(memory.lifetime?.predictedChurnRisk ?? 0) > 0.6)
    .sort((a, b) => Number(b.lifetime?.predictedChurnRisk ?? 0) - Number(a.lifetime?.predictedChurnRisk ?? 0))
    .slice(0, limit);
}

export async function generatePersonalizationVectors(customerId: string) {
  const memory = await getCustomerMemory(customerId);
  if (!memory) return null;

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return null;

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: GROQ_API_KEY });

  const preferenceText = `
    Favorite categories: ${memory.shoppingPreferences?.favoriteCategories?.join(", ") || "not set"}
    Brand preferences: ${JSON.stringify(memory.shoppingPreferences?.brandAffinity) || "none"}
    Color preferences: ${memory.shoppingPreferences?.colorPreferences?.join(", ") || "any"}
    Segment: ${memory.lifetime?.customerSegment}
  `.trim();

  const res = await client.embeddings.create({
    model: "text-embedding-3-large",
    input: preferenceText
  });

  const embeddings = res.data?.[0]?.embedding || [];

  return upsertCustomerMemory(customerId, {
    personalizationVectors: {
      embeddings: embeddings.slice(0, 384),
      seasonalPreferences: {},
      dayOfWeekBias: {}
    }
  });
}

async function getAllCustomerMemory() {
  return withRedis(async (redis) => {
    const rows = await redis.hgetall(CUSTOMER_MEMORY_INDEX);
    return Object.values(rows)
      .map((row) => {
        try {
          return JSON.parse(row) as CustomerMemoryRecord;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as CustomerMemoryRecord[];
  }, [] as CustomerMemoryRecord[]);
}
