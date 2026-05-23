import Groq from "groq-sdk";

export async function generateAIResponse(prompt: string) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

  if (!apiKey) {
    return `Hi there! Your message is important to us and we'll get back to you shortly. In the meantime, here's what we have so far from your request: ${prompt}`;
  }

  const client = new Groq({ apiKey });

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 200
  });

  return String(response.choices?.[0]?.message?.content ?? "").trim();
}
