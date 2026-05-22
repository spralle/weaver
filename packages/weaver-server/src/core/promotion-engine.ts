import type { WeaverError } from "../types/errors";
import { createWeaverError } from "../types/errors";
import type { WeaverConfigService } from "./config-service";
import { isScopedLayer, parseScopeLayer } from "./scope-utils";

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
}

export interface PromotionEngine {
  promote(request: PromotionRequest): Promise<PromotionResult>;
}

function isPromotableLayer(layer: string): boolean {
  return layer === "platform" || isScopedLayer(layer);
}

/**
 * @alpha Not yet wired into startWeaverServer — planned for cross-environment promotion.
 */
export function createPromotionEngine(
  options: PromotionEngineOptions,
): PromotionEngine {
  const { configService } = options;

  return {
    async promote(request: PromotionRequest): Promise<PromotionResult> {
      const { key, fromEnvironment, toEnvironment, layer, actor } = request;

      if (!isPromotableLayer(layer)) {
        return {
          success: false,
          method: "direct",
          error: createWeaverError(
            "POLICY_VIOLATION",
            `Promotion only supported for platform/scoped layers, got "${layer}"`,
          ),
        };
      }

      // Read value from source environment
      const parsed = parseScopeLayer(layer);
      const scopePath = parsed
        ? [{ scopeId: parsed.scopeId, value: parsed.value }]
        : undefined;
      const value = await configService.get(
        key,
        scopePath ? { scopePath } : undefined,
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

      const changePolicy = "direct-allowed";

      if (changePolicy !== "direct-allowed") {
        return { success: true, method: "pull-request" };
      }

      const result = await configService.set(layer, key, value, {
        environment: toEnvironment,
        actor,
      });
      if (!result.success) {
        return {
          success: false,
          method: "direct" as const,
          error: createWeaverError(
            "GIT_ERROR",
            result.error ?? "Write failed during promotion",
          ),
        };
      }

      const provider = configService.providers.find((p) => p.layer === layer);
      if (provider) {
        await configService.reloadProvider(provider.id);
      }

      return { success: true, method: "direct" };
    },
  };
}
