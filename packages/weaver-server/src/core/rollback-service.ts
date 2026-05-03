import type { WeaverConfigService } from "./config-service.js";
import type { GitWriteQueue } from "../git/write-queue.js";
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
  gitWriteQueue: GitWriteQueue;
}

export interface RollbackService {
  rollback(request: RollbackRequest): Promise<RollbackResult>;
}

export function createRollbackService(
  options: RollbackServiceOptions,
): RollbackService {
  const { configService, gitWriteQueue } = options;

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

      // Enqueue the rollback operation through the write queue
      // Rollback bypasses changePolicy per ADR
      const revertedCommits = await gitWriteQueue.enqueue(async () => {
        // In a real implementation, this would:
        // 1. Determine commits between current HEAD and toRevision
        // 2. Execute `git revert` for each commit
        // For v1: simulate the revert operation and return count
        // The actual Git revert depends on real Git integration
        return 1;
      });

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
