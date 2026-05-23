"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SESSION_KEY = "vrixo_session_id";
const HIDDEN_PATH_PREFIXES = ["/dashboard-admin-dreamcart-ravi"];

export function AiSupportWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi, I am Vrixo AI Support. Ask about orders, delivery, returns, payments, or product recommendations."
    }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hidden = useMemo(
    () => HIDDEN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)),
    [pathname]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (hidden) {
    return null;
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || busy) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          sessionId: getSessionId()
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | { reply?: string; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Support chat is unavailable right now.");
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload?.reply?.trim() || "Thanks for reaching out. Our team will help you shortly."
        }
      ]);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Support chat is unavailable right now."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dc-ai-support-root" aria-live="polite">
      {open ? (
        <section
          className="dc-ai-support-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Vrixo AI support chat"
        id="vrixo-ai-support-panel"
      >
          <header className="dc-ai-support-header">
            <div>
              <p className="dc-ai-support-eyebrow">Vrixo Support</p>
              <h2>AI Shopping Assistant</h2>
            </div>
            <button
              type="button"
              className="dc-ai-support-close"
              aria-label="Close support chat"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div ref={scrollRef} className="dc-ai-support-messages">
            {messages.map((message) => (
              <article
                key={message.id}
                className={cn(
                  "dc-ai-support-message",
                  message.role === "user" && "dc-ai-support-message-user"
                )}
              >
                {message.content}
              </article>
            ))}
            {busy ? (
              <div className="dc-ai-support-typing">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            ) : null}
          </div>

          {error ? <p className="dc-ai-support-error">{error}</p> : null}

          <form
            className="dc-ai-support-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about your order, delivery, or products..."
              aria-label="Message Vrixo AI support"
              maxLength={1200}
              disabled={busy}
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send message">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className="dc-ai-support-launcher"
        aria-expanded={open}
        aria-controls="vrixo-ai-support-panel"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        <span>{open ? "Close" : "AI Help"}</span>
      </button>
    </div>
  );
}

function getSessionId() {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, next);
  return next;
}
