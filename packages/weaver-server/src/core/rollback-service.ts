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

      // TODO: Implement actual Git revert via configService or provider
      const revertedCommits = 1;

      // Reload affected provider
      const provider = configService.providers.find(
        (p) => p.layer === layer,
      );
      if (provider) {
        await configService.reloadProvider(provider.id);
      }

      return { success: true, revertedCommits };
    },
  };
}
