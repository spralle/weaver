import type { WriteOptions, WriteResult } from "./transport";

interface QueuedWrite {
  key: string;
  value: unknown;
  options: WriteOptions | undefined;
  timestamp: number;
}

/** Buffered write queue that batches mutations for deferred sending. */
export interface WriteQueue {
  enqueue(key: string, value: unknown, options?: WriteOptions): void;
  drain(
    sender: (
      key: string,
      value: unknown,
      opts?: WriteOptions,
    ) => Promise<WriteResult>,
  ): Promise<WriteResult[]>;
  readonly pending: number;
  clear(): void;
}

/**
 * Creates a write queue that buffers mutations until explicitly drained.
 * Useful for offline-first writes and batching.
 */
export function createWriteQueue(): WriteQueue {
  const queue: QueuedWrite[] = [];

  return {
    enqueue(key, value, options) {
      queue.push({ key, value, options, timestamp: Date.now() });
    },

    async drain(sender) {
      const results: WriteResult[] = [];
      while (queue.length > 0) {
        const item = queue.shift();
        if (item === undefined) continue;
        const result = await sender(item.key, item.value, item.options);
        results.push(result);
      }
      return results;
    },

    get pending() {
      return queue.length;
    },

    clear() {
      queue.length = 0;
    },
  };
}
