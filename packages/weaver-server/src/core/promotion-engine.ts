import type { WeaverConfigService } from "./config-service.js";
import type { GitWriteQueue } from "../git/write-queue.js";
import type { WeaverError } from "../types/errors.js";
import { createWeaverError } from "../types/errors.js";

export interface PromotionRequest {
  key: string;
  fromEnvironment: string;
  toEnvironment: string;
  layer: string;
  actor: string;
}

export interface PromotionResult {
  success: boolean;
  method: "direct" | "pull-request";
  prUrl?: string;
  error?: WeaverError;
}

export interface PromotionEngineOptions {
  configService: WeaverConfigService;
  gitWriteQueue: GitWriteQueue;
}

export interface PromotionEngine {
  promote(request: PromotionRequest): Promise<PromotionResult>;
}

const ALLOWED_LAYER_PREFIXES = ["platform", "tenant:"];

function isPromotableLayer(layer: string): boolean {
  return ALLOWED_LAYER_PREFIXES.some(
    (prefix) => layer === prefix || layer.startsWith(prefix),
  );
}

export function createPromotionEngine(
  options: PromotionEngineOptions,
): PromotionEngine {
  const { configService, gitWriteQueue } = options;

  return {
    async promote(request: PromotionRequest): Promise<PromotionResult> {
      const { key, fromEnvironment, toEnvironment, layer, actor } = request;

      if (!isPromotableLayer(layer)) {
        return {
          success: false,
          method: "direct",
          error: createWeaverError(
            "POLICY_VIOLATION",
            `Promotion only supported for platform/tenant layers, got "${layer}"`,
          ),
        };
      }

      // Read value from source environment
      const tenantId = layer.startsWith("tenant:")
        ? layer.slice("tenant:".length)
        : undefined;
      const value = await configService.get(
        "_promotion",
        key,
        tenantId ? { tenantId } : undefined,
      );

      if (value === undefined) {
        return {
          success: false,
          method: "direct",
          error: createWeaverError(
            "NOT_FOUND",
            `Key "${key}" not found in environment "${fromEnvironment}"`,
          ),
        };
      }

      // For v1, default changePolicy is "direct-allowed"
      const changePolicy = "direct-allowed";

      if (changePolicy !== "direct-allowed") {
        // Staging-gate or full-pipeline: would create PR
        // TODO: implement PR creation via gh CLI
        return { success: true, method: "pull-request" };
      }

      // Direct promotion: write value to target environment via queue
      await gitWriteQueue.enqueue(async () => {
        const result = await configService.set(layer, key, value, {
          environment: toEnvironment,
          actor,
        });
        if (!result.success) {
          throw createWeaverError(
            "GIT_ERROR",
            result.error ?? "Write failed during promotion",
          );
        }
      });

      // Reload affected provider
      const provider = configService.providers.find(
        (p) => p.layer === layer,
      );
      if (provider) {
        await configService.reloadProvider(provider.id);
      }

      return { success: true, method: "direct" };
    },
  };
}
