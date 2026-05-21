import type { WriteOptions, WriteResult } from "./transport.js";

interface QueuedWrite {
  key: string;
  value: unknown;
  options: WriteOptions | undefined;
  timestamp: number;
}

export interface WriteQueue {
  enqueue(key: string, value: unknown, options?: WriteOptions): void;
  drain(
    sender: (key: string, value: unknown, opts?: WriteOptions) => Promise<WriteResult>,
  ): Promise<WriteResult[]>;
  readonly pending: number;
  clear(): void;
}

export function createWriteQueue(): WriteQueue {
  const queue: QueuedWrite[] = [];

  return {
    enqueue(key, value, options) {
      queue.push({ key, value, options, timestamp: Date.now() });
    },

    async drain(sender) {
      const results: WriteResult[] = [];
      while (queue.length > 0) {
        const item = queue.shift()!;
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
