import { connectMongo } from "@/lib/mongo/models";
import mongoose, { Schema } from "mongoose";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const ProductEmbeddingSchema = new Schema({ productId: { type: String, index: true }, vector: { type: [Number] }, text: String, updatedAt: Date });
const ProductEmbedding = mongoose.models.ProductEmbedding || mongoose.model("ProductEmbedding", ProductEmbeddingSchema);

export async function generateAndStoreEmbedding(productId: string, text: string) {
  if (!OPENAI_API_KEY) throw new Error("OpenAI API key not configured");
  await connectMongo();
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const res = await client.embeddings.create({ model: "text-embedding-3-large", input: text });
  const vector = res.data?.[0]?.embedding ?? [];
  await ProductEmbedding.findOneAndUpdate({ productId }, { productId, vector, text, updatedAt: new Date() }, { upsert: true });
  return { productId, vector };
}

export async function searchSimilarProductsByEmbedding(vector: number[], limit = 8) {
  // basic approximate search: load all and compute cosine — for production use FAISS/pgvector
  await connectMongo();
  const rows = await ProductEmbedding.find({}).lean().limit(5000);
  function dot(a: number[], b: number[]) { return a.reduce((s,i,idx)=>s + (i*(b[idx]||0)),0); }
  function norm(a: number[]) { return Math.sqrt(a.reduce((s,i)=>s + i*i,0)); }
  const scores = rows.map((r:any) => ({ productId: r.productId, score: dot(r.vector, vector)/(norm(r.vector)*norm(vector)||1) }));
  scores.sort((a,b)=>b.score - a.score);
  return scores.slice(0, limit);
}
