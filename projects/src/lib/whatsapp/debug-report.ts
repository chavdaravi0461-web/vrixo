import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage<DebugReport>();

export class DebugReport {
  requestId = "";
  incomingMessage = "";
  whatsappNumber = "";
  normalizedNumber = "";
  customerLookup: "SUCCESS" | "FAILED" = "FAILED";
  customerId: string | null = null;
  userLookup: "SUCCESS" | "FAILED" = "FAILED";
  userId: string | null = null;
  orderPhoneQuery: string | null = null;
  orderUserQuery: string | null = null;
  ordersFound = 0;
  latestOrder: string | null = null;
  supportRoute = "";
  contextBuilder: "SUCCESS" | "FAILED" = "FAILED";
  intent = "";
  handler = "";
  execution: "SUCCESS" | "FAILED" = "SUCCESS";
  failureStage = "";
  rootCause = "";
  private diagnostics: string[] = [];

  diag(msg: string) {
    this.diagnostics.push(msg);
  }

  format(): string {
    const L = "=".repeat(60);
    const lines: string[] = [
      L,
      "DEBUG REPORT",
      L,
      "",
      "Incoming Message:",
      `  ${this.incomingMessage}`,
      "",
      "WhatsApp Number:",
      `  ${this.whatsappNumber}`,
      "",
      "Normalized Number:",
      `  ${this.normalizedNumber}`,
      "",
      "Customer Lookup:",
      `  ${this.customerLookup}`,
      "",
      "Customer ID:",
      `  ${this.customerId ?? "null"}`,
      "",
      "User Lookup:",
      `  ${this.userLookup}`,
      "",
      "User ID:",
      `  ${this.userId ?? "null"}`,
      "",
      "Order Lookup:",
      `  phone query: ${this.orderPhoneQuery ?? "N/A"}`,
      `  user query: ${this.orderUserQuery ?? "N/A"}`,
      `  Orders Found: ${this.ordersFound}`,
      `  Latest Order: ${this.latestOrder ?? "null"}`,
      "",
      "Support Route Used:",
      `  ${this.supportRoute}`,
      "",
      "Context Builder:",
      `  ${this.contextBuilder}`,
      "",
      "Intent:",
      `  ${this.intent}`,
      "",
      "Handler:",
      `  ${this.handler}`,
      "",
      "Execution:",
      `  ${this.execution}`,
      "",
      "Failure Stage:",
      `  ${this.failureStage || "(none)"}`,
      "",
      "Root Cause:",
      `  ${this.rootCause || "(none)"}`,
    ];

    if (this.diagnostics.length > 0) {
      lines.push("", "Additional Diagnostics:", "");
      for (const d of this.diagnostics) {
        lines.push(`  - ${d}`);
      }
    }

    lines.push("", L);
    return lines.join("\n");
  }
}

export function runWithDebugReport<T>(requestId: string, fn: () => T): T {
  const report = new DebugReport();
  report.requestId = requestId;
  return storage.run(report, fn);
}

export function getDebugReport(): DebugReport {
  return storage.getStore() ?? new DebugReport();
}

export function printDebugReport(): void {
  const r = getDebugReport();
  console.log(r.format());
}
