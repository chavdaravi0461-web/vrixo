import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

export interface TraceContext {
  traceId: string;
  parentSpanId: string | null;
  spanId: string;
  origin: string;
  service: string;
  startTime: number;
  baggage: Record<string, string>;
}

const als = new AsyncLocalStorage<TraceContext>();

let globalTraceCounter = 0;

function generateId(): string {
  globalTraceCounter++;
  const ts = Date.now().toString(36);
  const rand = crypto.randomUUID().slice(0, 12);
  return `${ts}-${rand}-${globalTraceCounter.toString(36)}`;
}

export function createTrace(origin: string, service: string, parentSpanId?: string | null): TraceContext {
  const parent = als.getStore();
  return {
    traceId: parent?.traceId ?? generateId(),
    parentSpanId: parentSpanId ?? parent?.spanId ?? null,
    spanId: generateId(),
    origin,
    service,
    startTime: performance.now(),
    baggage: parent ? { ...parent.baggage } : {},
  };
}

export function runWithTrace<T>(origin: string, service: string, fn: () => Promise<T>): Promise<T> {
  const trace = createTrace(origin, service);
  return als.run(trace, fn);
}

export function getTrace(): TraceContext | null {
  return als.getStore() ?? null;
}

export function getTraceId(): string {
  return als.getStore()?.traceId ?? "no-trace";
}

export function getSpanId(): string {
  return als.getStore()?.spanId ?? "no-span";
}

export function addTraceBaggage(key: string, value: string): void {
  const trace = als.getStore();
  if (trace) {
    trace.baggage[key] = value;
  }
}

export function getTraceDuration(): number {
  const trace = als.getStore();
  return trace ? performance.now() - trace.startTime : 0;
}

export function traceHeaders(): Record<string, string> {
  const trace = als.getStore();
  if (!trace) return {};
  return {
    "x-trace-id": trace.traceId,
    "x-span-id": trace.spanId,
    "x-parent-span-id": trace.parentSpanId ?? "",
    "x-trace-origin": trace.origin,
    "x-trace-service": trace.service,
  };
}

export function extractTraceFromHeaders(headers: Headers | Record<string, string>, service: string): TraceContext {
  const getHeader = (name: string): string | null => {
    if (headers instanceof Headers) return headers.get(name);
    return headers[name] ?? null;
  };

  const traceId = getHeader("x-trace-id") || generateId();
  const parentSpanId = getHeader("x-span-id") || null;
  const origin = getHeader("x-trace-origin") || "external";
  const baggage: Record<string, string> = {};

  const baggageHeader = getHeader("x-trace-baggage");
  if (baggageHeader) {
    for (const pair of baggageHeader.split(",")) {
      const [key, value] = pair.split("=").map((s) => s.trim());
      if (key && value) baggage[key] = value;
    }
  }

  return {
    traceId,
    parentSpanId,
    spanId: generateId(),
    origin,
    service,
    startTime: performance.now(),
    baggage,
  };
}

export async function withChildTrace<T>(spanName: string, fn: () => Promise<T>): Promise<T> {
  const parent = als.getStore();
  const child: TraceContext = {
    traceId: parent?.traceId ?? generateId(),
    parentSpanId: parent?.spanId ?? null,
    spanId: generateId(),
    origin: parent?.origin ?? "internal",
    service: parent?.service ?? "unknown",
    startTime: performance.now(),
    baggage: parent ? { ...parent.baggage } : {},
  };
  return als.run(child, fn);
}
