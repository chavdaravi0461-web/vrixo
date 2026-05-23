import { connectMongo } from "@/lib/mongo/models";
import mongoose, { Schema } from "mongoose";

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
};

// Customer memory for personalization
const CustomerMemorySchema = new Schema({
  customerId: { type: String, index: true, unique: true },
  email: String,
  phone: String,
  shoppingPreferences: {
    favoriteCategories: [String],
    brandAffinity: { type: Map, of: Number }, // brand: score
    sizeHistory: { type: Map, of: Number }, // size: frequency
    colorPreferences: [String],
    priceRange: { min: Number, max: Number },
    preferredDeliverySpeed: String // "express", "standard", "budget"
  },
  purchaseHistory: {
    totalPurchases: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    lastPurchaseDate: Date,
    categoryFrequency: { type: Map, of: Number }
  },
  behaviorMetrics: {
    browsingFrequency: { type: Number, default: 0 }, // sessions per month
    conversionRate: { type: Number, default: 0 }, // 0-1
    cartAbandonmentRate: { type: Number, default: 0 },
    returnRate: { type: Number, default: 0 },
    reviewsGiven: { type: Number, default: 0 }
  },
  lifetime: {
    customerSegment: String, // "vip", "loyal", "occasional", "at-risk"
    ltv: { type: Number, default: 0 }, // lifetime value
    predictedChurnRisk: { type: Number, default: 0 }, // 0-1
    engagementScore: { type: Number, default: 0 }, // 0-100
    npsScore: Number
  },
  personalizationVectors: {
    embeddings: [Number], // 384-dim embeddings for semantic search
    seasonalPreferences: { type: Map, of: Number }, // seasonal affinity
    dayOfWeekBias: { type: Map, of: Number } // purchase day preference
  },
  lastUpdated: { type: Date, default: Date.now }
});

const CustomerMemory = mongoose.models.CustomerMemory || mongoose.model("CustomerMemory", CustomerMemorySchema);

export async function upsertCustomerMemory(customerId: string, updates: Partial<CustomerMemoryRecord>) {
  await connectMongo();
  return CustomerMemory.findOneAndUpdate({ customerId }, { ...updates, lastUpdated: new Date() }, { upsert: true, new: true });
}

export async function getCustomerMemory(customerId: string): Promise<CustomerMemoryRecord | null> {
  await connectMongo();
  return CustomerMemory.findOne({ customerId }).lean().exec() as Promise<CustomerMemoryRecord | null>;
}

export async function recordPurchase(customerId: string, orderData: {
  amount: number;
  categories: string[];
  items: Array<{ title: string; category: string; size?: string; color?: string }>;
}) {
  await connectMongo();
  const memory = await getCustomerMemory(customerId);

  if (!memory) {
    // First purchase
    return upsertCustomerMemory(customerId, {
      purchaseHistory: {
        totalPurchases: 1,
        totalSpent: orderData.amount,
        averageOrderValue: orderData.amount,
        lastPurchaseDate: new Date(),
        categoryFrequency: Object.fromEntries(orderData.categories.map((c) => [c, 1]))
      },
      lifetime: {
        customerSegment: "new",
        ltv: orderData.amount,
        engagementScore: 50
      }
    });
  }

  // Update existing memory
  const newTotalPurchases = Number(memory.purchaseHistory?.totalPurchases ?? 0) + 1;
  const newTotalSpent = Number(memory.purchaseHistory?.totalSpent ?? 0) + orderData.amount;
  const newAOV = newTotalSpent / newTotalPurchases;

  // Track size/color preferences
  const sizeMap = new Map<string, number>(Object.entries(memory.shoppingPreferences?.sizeHistory ?? {}));
  const colorSet = new Set(memory.shoppingPreferences?.colorPreferences || []);
  for (const item of orderData.items) {
    if (item.size) sizeMap.set(item.size, (sizeMap.get(item.size) || 0) + 1);
    if (item.color) colorSet.add(item.color);
  }

  // Update category frequency
  const categoryMap = new Map<string, number>(Object.entries(memory.purchaseHistory?.categoryFrequency ?? {}));
  for (const cat of orderData.categories) {
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
  }

  // Calculate LTV and segment
  let segment = "loyal";
  if (newTotalPurchases === 1) segment = "new";
  else if (newTotalPurchases >= 10 || newTotalSpent > 50000) segment = "vip";
  else if (newTotalPurchases < 3) segment = "occasional";

  return upsertCustomerMemory(customerId, {
    purchaseHistory: {
      totalPurchases: newTotalPurchases,
      totalSpent: newTotalSpent,
      averageOrderValue: newAOV,
      lastPurchaseDate: new Date(),
      categoryFrequency: Object.fromEntries(categoryMap)
    },
    shoppingPreferences: {
      ...memory.shoppingPreferences,
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
  await connectMongo();
  const memory = await getCustomerMemory(customerId);
  void duration;
  const currentBrowseFreq = memory?.behaviorMetrics?.browsingFrequency || 0;
  const categoryMap = new Map<string, number>(memory?.shoppingPreferences?.favoriteCategories?.map((c: string) => [c, 0]) || []);
  for (const cat of categories) {
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
  }

  return upsertCustomerMemory(customerId, {
    behaviorMetrics: {
      ...memory?.behaviorMetrics,
      browsingFrequency: currentBrowseFreq + 1
    },
    shoppingPreferences: {
      ...memory?.shoppingPreferences,
      favoriteCategories: Array.from(categoryMap.keys()).slice(0, 5)
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

  // Inactivity is primary churn signal
  if (daysSinceLastPurchase > 90) riskScore += 40;
  else if (daysSinceLastPurchase > 60) riskScore += 25;
  else if (daysSinceLastPurchase > 30) riskScore += 10;

  // Return/refund pattern
  if ((memory.behaviorMetrics?.returnRate ?? 0) > 0.3) riskScore += 20;

  // Low engagement
  if ((memory.lifetime?.engagementScore ?? 0) < 30) riskScore += 15;

  // Cart abandonment trend
  if ((memory.behaviorMetrics?.cartAbandonmentRate ?? 0) > 0.5) riskScore += 15;

  return Math.min(100, riskScore);
}

export async function getTopSegmentCustomers(segment: string, limit = 100) {
  await connectMongo();
  return CustomerMemory.find({ "lifetime.customerSegment": segment })
    .sort({ "lifetime.ltv": -1 })
    .limit(limit)
    .lean();
}

export async function getAtRiskCustomers(limit = 50) {
  await connectMongo();
  return CustomerMemory.find({ "lifetime.predictedChurnRisk": { $gt: 0.6 } })
    .sort({ "lifetime.predictedChurnRisk": -1 })
    .limit(limit)
    .lean();
}

export async function generatePersonalizationVectors(customerId: string) {
  const memory = await getCustomerMemory(customerId);
  if (!memory) return null;

  // Generate simple embeddings from preferences (in production, use OpenAI embeddings)
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
      embeddings: embeddings.slice(0, 384), // truncate to 384 dims
      seasonalPreferences: {},
      dayOfWeekBias: {}
    }
  });
}
