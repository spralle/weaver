import type { WeaverConfigService } from "./config-service.js";
import type { WeaverError } from "../types/errors.js";
import { createWeaverError } from "../types/errors.js";

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

      const provider = configService.providers.find(
        (p) => p.layer === layer,
      );

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

      if (!("revert" in provider) || typeof provider.revert !== "function") {
        return {
          success: false,
          revertedCommits: 0,
          error: createWeaverError(
            "VALIDATION_ERROR",
            `Provider for layer "${layer}" does not support revert`,
          ),
        };
      }

      const revertFn = provider.revert as (
        toRevision: string,
        actor: string,
      ) => Promise<{ revertedCommits: number }>;

      const { revertedCommits } = await revertFn(toRevision, actor);

      await configService.reloadProvider(provider.id);

      return { success: true, revertedCommits };
    },
  };
}
