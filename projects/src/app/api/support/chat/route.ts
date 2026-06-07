import { streamAIResponse } from "@/lib/ai/provider";

const SESSION_WINDOW = 30 * 60 * 1000;

interface SessionStore {
  [sessionId: string]: {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    expiresAt: number;
  };
}

const sessions: SessionStore = {};

function getSession(sessionId: string) {
  const now = Date.now();
  if (sessions[sessionId] && sessions[sessionId].expiresAt > now) {
    return sessions[sessionId].messages;
  }
  sessions[sessionId] = { messages: [], expiresAt: now + SESSION_WINDOW };
  return sessions[sessionId].messages;
}

function pruneExpiredSessions() {
  const now = Date.now();
  for (const key of Object.keys(sessions)) {
    if (sessions[key].expiresAt <= now) delete sessions[key];
  }
}

setInterval(pruneExpiredSessions, 5 * 60 * 1000);

function safeParseBody(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const start = Date.now();

  try {
    const bodyText = await request.text();
    const body = safeParseBody(bodyText);

    if (!body || typeof body.message !== "string" || !body.message.trim()) {
      return new Response(JSON.stringify({ message: "Message is required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const userMessage = body.message.trim();
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : crypto.randomUUID();

    if (userMessage.length > 2000) {
      return new Response(
        JSON.stringify({ message: "Message too long. Please keep it under 2000 characters." }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    const history = getSession(sessionId);
    history.push({ role: "user", content: userMessage });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const encoder = new TextEncoder();
          for await (const chunk of streamAIResponse(history)) {
            if (chunk) {
              controller.enqueue(encoder.encode(chunk));
            }
          }
          history.push({ role: "assistant", content: "" });
          controller.close();
          console.log(`[chat] session=${sessionId} duration=${Date.now() - start}ms`);
        } catch (err) {
          console.error("[chat] stream error:", err);
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode("I'm sorry, something went wrong. Please try again or contact support."),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[chat] fatal error:", err);
    return new Response(
      JSON.stringify({ message: "Service unavailable. Please try again later." }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
