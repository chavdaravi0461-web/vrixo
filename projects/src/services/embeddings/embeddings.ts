import { withRedis } from "@/lib/redis";

const EMBEDDING_INDEX_KEY = "embeddings:products:index";

type ProductEmbeddingRecord = {
  productId: string;
  vector: number[];
  text: string;
  updatedAt: string;
};

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OpenAI API key not configured");
  return key;
}

export async function generateAndStoreEmbedding(productId: string, text: string) {
  const OPENAI_API_KEY = getOpenAIKey();
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const res = await client.embeddings.create({ model: "text-embedding-3-large", input: text });
  const vector = res.data?.[0]?.embedding ?? [];
  const record: ProductEmbeddingRecord = {
    productId,
    vector,
    text,
    updatedAt: new Date().toISOString()
  };

  await withRedis(async (redis) => {
    await redis.hset(EMBEDDING_INDEX_KEY, productId, JSON.stringify(record));
    return true;
  }, false);

  return { productId, vector };
}

export async function searchSimilarProductsByEmbedding(vector: number[], limit = 8) {
  return withRedis(async (redis) => {
    const rows = await redis.hgetall(EMBEDDING_INDEX_KEY);
    const records = Object.values(rows)
      .map(parseRecord)
      .filter(Boolean) as ProductEmbeddingRecord[];
    const scores = records.map((record) => ({
      productId: record.productId,
      score: cosineSimilarity(record.vector, vector)
    }));
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, limit);
  }, [] as Array<{ productId: string; score: number }>);
}

function parseRecord(value: string): ProductEmbeddingRecord | null {
  try {
    return JSON.parse(value) as ProductEmbeddingRecord;
  } catch {
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]) {
  const denominator = norm(a) * norm(b) || 1;
  return dot(a, b) / denominator;
}

function dot(a: number[], b: number[]) {
  return a.reduce((sum, value, index) => sum + value * (b[index] || 0), 0);
}

function norm(a: number[]) {
  return Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
}
