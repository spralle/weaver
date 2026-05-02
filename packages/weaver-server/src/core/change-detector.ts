// Change detection — Git polling and manual trigger for webhook integration
import type { GitManager } from "../storage/git-manager.js";
import type { WeaverConfigService } from "./config-service.js";

export interface ChangeDetectorOptions {
  configService: WeaverConfigService;
  gitProviderIds?: string[];
  gitManager?: GitManager;
  pollIntervalMs?: number;
}

export interface ChangeDetector {
  start(): void;
  stop(): void;
  triggerCheck(): Promise<void>;
}

export function createChangeDetector(
  options: ChangeDetectorOptions,
): ChangeDetector {
  const {
    configService,
    gitManager,
    gitProviderIds = [],
    pollIntervalMs = 5000,
  } = options;

  let intervalHandle: ReturnType<typeof setInterval> | undefined;

  async function performCheck(): Promise<void> {
    if (gitManager) {
      await gitManager.pull();
    }
    for (const providerId of gitProviderIds) {
      await configService.reloadProvider(providerId);
    }
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
