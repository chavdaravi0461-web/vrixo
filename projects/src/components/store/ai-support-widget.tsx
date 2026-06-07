"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  ChevronDown,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SESSION_KEY = "vrixo_session_id";
const HIDDEN_PATH_PREFIXES = ["/dashboard-admin-vrixo-ravi"];

const ease = [0.19, 1, 0.22, 1] as const;

const panelVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.94 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.35, ease },
  },
  exit: { opacity: 0, y: 24, scale: 0.94 },
};

const messageVariants = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  visible: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.35, ease },
  },
};

function formatMd(text: string) {
  let processed = text
    .replace(/━━━/g, "<br/>")
    .replace(/━━/g, "")
    .replace(/```(\w*)\n?([\s\S]*?)```/g, "<code>$2</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class='dc-inline-code'>$1</code>")
    .replace(/•/g, "•")
    .replace(/\n/g, "<br/>");
  return processed;
}

function TypingDots() {
  return (
    <motion.div
      className="dc-ai-support-message flex items-center gap-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <span className="flex items-center gap-1">
        <motion.span
          className="inline-block h-2 w-2 rounded-full bg-white"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
        />
        <motion.span
          className="inline-block h-2 w-2 rounded-full bg-white"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
        />
        <motion.span
          className="inline-block h-2 w-2 rounded-full bg-white"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
        />
      </span>
      <span className="text-xs font-bold uppercase tracking-wider text-[var(--dc-muted)]">
        Thinking
      </span>
    </motion.div>
  );
}

export function AiSupportWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Namaste. I am Vrixo Concierge. I can help with orders, tracking, products, payments, COD, returns, or cancellations. What would you like me to handle today?",
    },
  ]);

  const hidden = useMemo(
    () => HIDDEN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)),
    [pathname],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (hidden) return null;

  async function sendMessage(text?: string) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || busy) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!text) setInput("");
    setBusy(true);
    setError(null);
    setQuickReplies([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, sessionId: getSessionId() }),
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        reply?: string;
        quickReplies?: string[];
        error?: string;
      } | null;

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? "Support chat is unavailable right now.");
      }

      if (data.reply?.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.reply!.trim(),
          },
        ]);
      }

      if (data.quickReplies && data.quickReplies.length > 0) {
        setQuickReplies(data.quickReplies);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Support chat is unavailable right now.";
      setError(msg);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3 sm:bottom-8 sm:right-8">
      <AnimatePresence>
        {open ? (
          <motion.section
            key="chat-panel"
            className="dc-ai-support-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Vrixo Concierge chat"
            id="vrixo-ai-support-panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <header className="dc-ai-support-header">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-white to-[var(--dc-gold-dark)] shadow-lg shadow-white/20">
                  <Bot className="h-5 w-5 text-black" />
                </span>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/60">
                    Vrixo
                  </p>
                  <h2 className="text-sm font-black text-white">
                    Vrixo Concierge
                  </h2>
                </div>
              </div>
              <button
                type="button"
                className="dc-ai-support-close"
                aria-label="Close support chat"
                onClick={() => {
                  abortRef.current?.abort();
                  setOpen(false);
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="dc-ai-support-messages">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  variants={messageVariants}
                  initial="hidden"
                  animate="visible"
                  className={cn(
                    "dc-ai-support-message",
                    message.role === "user" && "dc-ai-support-message-user",
                  )}
                >
                  {message.role === "assistant" ? (
                    <span
                      dangerouslySetInnerHTML={{ __html: formatMd(message.content) }}
                    />
                  ) : (
                    message.content
                  )}
                </motion.div>
              ))}

              {busy ? <TypingDots /> : null}

              {error ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="dc-ai-support-error"
                >
                  {error}
                </motion.p>
              ) : null}

              <div ref={messagesEndRef} />
            </div>

            <div className="dc-ai-support-footer">
              {quickReplies.length > 0 && !busy ? (
                <div className="flex flex-wrap gap-2 px-3 pt-2">
                  {quickReplies.map((qr) => (
                    <motion.button
                      key={qr}
                      type="button"
                      className="rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface-soft)] px-3 py-1.5 text-xs font-bold text-[var(--dc-muted)] transition hover:border-white hover:text-white"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => sendMessage(qr)}
                    >
                      {qr}
                    </motion.button>
                  ))}
                </div>
              ) : null}

              <form
                className="dc-ai-support-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything..."
                  aria-label="Message Vrixo Concierge"
                  maxLength={2000}
                  disabled={busy}
                />
                <motion.button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Send message"
                  whileTap={{ scale: 0.92 }}
                  className={
                    busy || !input.trim()
                      ? "dc-ai-support-send disabled"
                      : "dc-ai-support-send"
                  }
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </motion.button>
              </form>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        className="dc-ai-support-launcher"
        aria-expanded={open}
        aria-controls="vrixo-ai-support-panel"
        onClick={() => setOpen((prev) => !prev)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}
        <span className="flex items-center gap-1">
          {open ? "Close" : "Concierge"}
          {!open ? (
            <Sparkles className="h-3 w-3 text-white" />
          ) : null}
        </span>
      </motion.button>
    </div>
  );
}

function getSessionId() {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}
