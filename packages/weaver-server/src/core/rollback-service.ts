import type { ConfigurationStorageProvider } from "@weaver/config-types";
import type { WeaverError } from "../types/errors.js";
import { createWeaverError } from "../types/errors.js";
import type { WeaverConfigService } from "./config-service.js";

export interface RevertableProvider extends ConfigurationStorageProvider {
  revert(
    toRevision: string,
    actor: string,
  ): Promise<{ revertedCommits: number }>;
}

function isRevertable(
  provider: ConfigurationStorageProvider,
): provider is RevertableProvider {
  return "revert" in provider && typeof provider.revert === "function";
}

export interface RollbackRequest {
  layer: string;
  environment: string;
  toRevision: string;
  actor: string;
}

export interface RollbackResult {
  success: boolean;
  revertedCommits: number;
  error?: WeaverError;
}

export interface RollbackServiceOptions {
  configService: WeaverConfigService;
}

export interface RollbackService {
  rollback(request: RollbackRequest): Promise<RollbackResult>;
}

/**
 * @alpha Not yet wired into startWeaverServer — planned for revision rollback support.
 */
export function createRollbackService(
  options: RollbackServiceOptions,
): RollbackService {
  const { configService } = options;

  return {
    async rollback(request: RollbackRequest): Promise<RollbackResult> {
      const { layer, toRevision, actor } = request;

      if (!toRevision) {
        return {
          success: false,
          revertedCommits: 0,
          error: createWeaverError(
            "VALIDATION_ERROR",
            "Target revision is required",
          ),
        };
      }

      const provider = configService.providers.find((p) => p.layer === layer);

      if (!provider) {
        return {
          success: false,
          revertedCommits: 0,
          error: createWeaverError(
            "VALIDATION_ERROR",
            `No provider found for layer "${layer}"`,
          ),
        };
      }

      if (!isRevertable(provider)) {
        return {
          success: false,
          revertedCommits: 0,
          error: createWeaverError(
            "VALIDATION_ERROR",
            `Provider for layer "${layer}" does not support revert`,
          ),
        };
      }

      const { revertedCommits } = await provider.revert(toRevision, actor);

      await configService.reloadProvider(provider.id);

      return { success: true, revertedCommits };
    },
  };
}
