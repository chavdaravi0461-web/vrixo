/**
 * Graceful shutdown — drains in-flight operations on SIGTERM/SIGINT.
 *
 * Prevents dropped requests during deployment/restart by:
 * 1. Rejecting new work immediately
 * 2. Draining event bus buffer
 * 3. Waiting for in-flight operations to complete
 * 4. Closing connections cleanly
 *
 * Usage:
 *   import { onShutdown } from "@/lib/graceful-shutdown";
 *   onShutdown(async () => { await flush(); });
 */

type ShutdownHandler = () => Promise<void>;

const handlers: ShutdownHandler[] = [];
let shuttingDown = false;
let registered = false;

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function onShutdown(handler: ShutdownHandler): void {
  handlers.push(handler);
  ensureRegistered();
}

function ensureRegistered(): void {
  if (registered) return;
  registered = true;

  if (typeof process === "undefined") return;

  const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];

  for (const signal of signals) {
    process.once(signal, async () => {
      shuttingDown = true;
      console.log(`[graceful-shutdown] received ${signal} — draining (${handlers.length} handlers)`);

      const results = await Promise.allSettled(
        handlers.map((h) => {
          const timeout = new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error("handler timed out")), 5_000)
          );
          return Promise.race([h(), timeout]);
        })
      );

      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        console.warn(`[graceful-shutdown] ${failures.length} handler(s) failed`);
      }

      console.log("[graceful-shutdown] complete — exiting");
      process.exit(0);
    });
  }
}

export function getShutdownState(): { shuttingDown: boolean; handlers: number } {
  return { shuttingDown, handlers: handlers.length };
}
