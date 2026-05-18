// Change detection — polling and manual trigger for webhook integration
import type { WeaverConfigService } from "./config-service.js";

export interface ChangeDetectorOptions {
  configService: WeaverConfigService;
  pollIntervalMs?: number;
}

export interface ChangeDetector {
  start(): void;
  stop(): void;
  triggerCheck(): Promise<void>;
}

/**
 * @alpha Not yet wired into startWeaverServer — planned for future webhook-triggered refresh.
 */
export function createChangeDetector(
  options: ChangeDetectorOptions,
): ChangeDetector {
  const { configService, pollIntervalMs = 5000 } = options;
  let intervalHandle: ReturnType<typeof setInterval> | undefined;

  async function performCheck(): Promise<void> {
    await configService.refreshProviders();
  }

  return {
    start(): void {
      if (intervalHandle !== undefined) return;
      intervalHandle = setInterval(() => {
        performCheck().catch(() => {
          // Swallow polling errors — next cycle will retry
        });
      }, pollIntervalMs);
    },

    stop(): void {
      if (intervalHandle !== undefined) {
        clearInterval(intervalHandle);
        intervalHandle = undefined;
      }
    },

    async triggerCheck(): Promise<void> {
      await performCheck();
    },
  };
}
