// Graceful shutdown manager
import type { WeaverLogger } from "@weaver/storage-provider-core";
import { consoleLogger } from "@weaver/storage-provider-core";

export interface ShutdownManagerOptions {
  drainTimeoutMs?: number; // default 10000
  onDrain?: () => Promise<void>;
  logger?: WeaverLogger;
}

export interface ShutdownManager {
  onShutdown(handler: () => Promise<void>): void;
  shutdown(): Promise<void>;
  readonly isShuttingDown: boolean;
}

export function createShutdownManager(
  options?: ShutdownManagerOptions,
): ShutdownManager {
  const drainTimeoutMs = options?.drainTimeoutMs ?? 10_000;
  const logger = options?.logger ?? consoleLogger;
  const handlers: Array<() => Promise<void>> = [];
  let shuttingDown = false;

  if (options?.onDrain) {
    handlers.push(options.onDrain);
  }

  const manager: ShutdownManager = {
    onShutdown(handler: () => Promise<void>): void {
      handlers.push(handler);
    },

    async shutdown(): Promise<void> {
      if (shuttingDown) return;
      shuttingDown = true;

      const timeout = new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, drainTimeoutMs);
        timer.unref?.();
      });

      const runHandlers = async () => {
        for (const handler of handlers) {
          try {
            await handler();
          } catch (err) {
            logger.error("[shutdown] handler failed:", err);
          }
        }
      };

      await Promise.race([runHandlers(), timeout]);
    },

    get isShuttingDown() {
      return shuttingDown;
    },
  };

  return manager;
}
