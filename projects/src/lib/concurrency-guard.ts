/**
 * ConcurrencyGuard — limits concurrent operations per resource.
 * Prevents resource exhaustion (DB connections, API calls, file handles)
 * under traffic spikes. Acts as admission control.
 */
export type ConcurrencySlot = { release: () => void; queued: boolean; waitMs: number };

export class ConcurrencyGuard {
  private active = 0;
  private queue: Array<{
    resolve: (slot: ConcurrencySlot) => void;
    reject: (err: Error) => void;
    enqueuedAt: number;
  }> = [];
  private name: string;
  private maxConcurrent: number;
  private maxQueueDepth: number;
  private timeoutMs: number;

  constructor(opts: {
    name: string;
    maxConcurrent?: number;
    maxQueueDepth?: number;
    timeoutMs?: number;
  }) {
    this.name = opts.name;
    this.maxConcurrent = opts.maxConcurrent ?? 10;
    this.maxQueueDepth = opts.maxQueueDepth ?? 100;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  get activeCount(): number {
    return this.active;
  }

  get queueDepth(): number {
    return this.queue.length;
  }

  get stats() {
    return {
      name: this.name,
      active: this.active,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueueDepth: this.maxQueueDepth,
    };
  }

  async acquire(timeoutMs?: number): Promise<ConcurrencySlot> {
    const enqueuedAt = Date.now();

    if (this.active < this.maxConcurrent) {
      this.active++;
      return { release: () => this.release(), queued: false, waitMs: 0 };
    }

    if (this.queue.length >= this.maxQueueDepth) {
      console.warn(`[concurrency] ${this.name} queue full — rejecting (depth=${this.queue.length})`);
      throw new Error(`Concurrency limit exceeded: ${this.name}`);
    }

    return new Promise<ConcurrencySlot>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex((e) => e.enqueuedAt === enqueuedAt);
        if (idx >= 0) this.queue.splice(idx, 1);
        reject(new Error(`Concurrency timeout: ${this.name}`));
      }, timeoutMs ?? this.timeoutMs);

      this.queue.push({
        resolve: (slot) => {
          clearTimeout(timer);
          resolve(slot);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        enqueuedAt,
      });
    });
  }

  async run<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    const slot = await this.acquire(timeoutMs);
    try {
      return await fn();
    } finally {
      slot.release();
    }
  }

  private release(): void {
    this.active--;
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        this.active++;
        next.resolve({
          release: () => this.release(),
          queued: true,
          waitMs: Date.now() - next.enqueuedAt,
        });
      }
    }
  }
}

export const dbConcurrencyGuard = new ConcurrencyGuard({
  name: "supabase",
  maxConcurrent: 20,
  maxQueueDepth: 200,
  timeoutMs: 15_000,
});

export const redisConcurrencyGuard = new ConcurrencyGuard({
  name: "redis",
  maxConcurrent: 30,
  maxQueueDepth: 500,
  timeoutMs: 10_000,
});

export const whatsappConcurrencyGuard = new ConcurrencyGuard({
  name: "whatsapp-api",
  maxConcurrent: 5,
  maxQueueDepth: 50,
  timeoutMs: 12_000,
});

export const aiConcurrencyGuard = new ConcurrencyGuard({
  name: "ai-api",
  maxConcurrent: 3,
  maxQueueDepth: 20,
  timeoutMs: 30_000,
});
