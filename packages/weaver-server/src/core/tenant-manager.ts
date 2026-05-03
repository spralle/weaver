import type { WeaverConfigService } from "./config-service.js";
import type { GitWriteQueue } from "../git/write-queue.js";
import type { SchemaRegistry } from "./schema-registry.js";
import type { WeaverError } from "../types/errors.js";
import { createWeaverError } from "../types/errors.js";

export interface ProvisionTenantRequest {
  tenantId: string;
  displayName?: string;
  actor: string;
}

export interface DeprovisionTenantRequest {
  tenantId: string;
  mode: "archive" | "delete";
  actor: string;
}

export interface TenantProvisionResult {
  success: boolean;
  tenantId: string;
  error?: WeaverError;
}

export interface TenantManagerOptions {
  configService: WeaverConfigService;
  gitWriteQueue: GitWriteQueue;
  schemaRegistry: SchemaRegistry;
}

export interface TenantManager {
  provision(request: ProvisionTenantRequest): Promise<TenantProvisionResult>;
  deprovision(
    request: DeprovisionTenantRequest,
  ): Promise<TenantProvisionResult>;
  listTenants(): string[];
}

export function createTenantManager(
  options: TenantManagerOptions,
): TenantManager {
  const { configService, gitWriteQueue } = options;
  const activeTenants = new Set<string>();

  // Initialize from existing providers
  for (const provider of configService.providers) {
    if (provider.layer.startsWith("tenant:")) {
      activeTenants.add(provider.layer.slice("tenant:".length));
    }
  }

  return {
    async provision(
      request: ProvisionTenantRequest,
    ): Promise<TenantProvisionResult> {
      const { tenantId, actor } = request;

      if (activeTenants.has(tenantId)) {
        return {
          success: false,
          tenantId,
          error: createWeaverError(
            "VALIDATION_ERROR",
            `Tenant "${tenantId}" already exists`,
          ),
        };
      }

      await gitWriteQueue.enqueue(async () => {
        // Create tenant layer entry via config service write
        // In real implementation: create tenant dir, write defaults, commit
        // If no provider exists yet for this tenant, the write is a no-op
        // (provider creation happens at infrastructure level)
        const layer = `tenant:${tenantId}`;
        const provider = configService.providers.find(
          (p) => p.layer === layer,
        );
        if (provider) {
          await configService.set(layer, "_weaver.tenant.id", tenantId, {
            environment: "default",
            actor,
          });
        }
      });

      activeTenants.add(tenantId);
      return { success: true, tenantId };
    },

    async deprovision(
      request: DeprovisionTenantRequest,
    ): Promise<TenantProvisionResult> {
      const { tenantId, mode, actor } = request;

      if (!activeTenants.has(tenantId)) {
        return {
          success: false,
          tenantId,
          error: createWeaverError(
            "TENANT_NOT_FOUND",
            `Tenant "${tenantId}" not found`,
          ),
        };
      }

      await gitWriteQueue.enqueue(async () => {
        // For archive: conceptually move to _archived/
        // For delete: remove tenant data
        // Both remove from active state
        const layer = `tenant:${tenantId}`;
        await configService.remove(layer, "_weaver.tenant.id", {
          environment: "default",
          actor,
        });
      });

      activeTenants.delete(tenantId);
      return { success: true, tenantId };
    },

    listTenants(): string[] {
      return [...activeTenants];
    },
  };
}
