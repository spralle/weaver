import { createWeaverError } from "../types/errors.js";
import type { WeaverError } from "../types/errors.js";

export interface GitWriteQueue {
  enqueue<T>(operation: () => Promise<T>): Promise<T>;
  drain(): Promise<void>;
  readonly pending: number;
  readonly isProcessing: boolean;
}

export interface GitWriteQueueOptions {
  maxDepth?: number;
}

interface QueueEntry {
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

export function createGitWriteQueue(options?: GitWriteQueueOptions): GitWriteQueue {
  const maxDepth = options?.maxDepth ?? 100;
  const queue: QueueEntry[] = [];
  let processing = false;
  let drainResolvers: Array<() => void> = [];

  async function processLoop(): Promise<void> {
    processing = true;
    while (queue.length > 0) {
      const entry = queue.shift()!;
      try {
        const result = await entry.execute();
        entry.resolve(result);
      } catch (err) {
        entry.reject(err);
      }
    }
    processing = false;
    for (const resolve of drainResolvers) {
      resolve();
    }
    drainResolvers = [];
  }

  return {
    enqueue<T>(operation: () => Promise<T>): Promise<T> {
      if (queue.length >= maxDepth) {
        return Promise.reject(
          createWeaverError("QUEUE_FULL", `Git write queue at capacity (${maxDepth})`),
        );
      }
      return new Promise<T>((resolve, reject) => {
        queue.push({
          execute: operation,
          resolve: resolve as (value: unknown) => void,
          reject,
        });
        if (!processing) {
          void processLoop();
        }
      });
    },

    drain(): Promise<void> {
      if (!processing && queue.length === 0) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        drainResolvers.push(resolve);
      });
    },

    get pending(): number {
      return queue.length;
    },

    get isProcessing(): boolean {
      return processing;
    },
  };
}
