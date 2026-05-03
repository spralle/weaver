// Scomp adapter — maps contract operations to WeaverConfigService
import type { WeaverConfigService, WriteContext } from "../core/config-service.js";
import type { ConfigDelta } from "../types/index.js";
import { createWeaverError } from "../types/index.js";

type Unsubscribe = () => void;

export interface ScompAdapterOptions {
  configService: WeaverConfigService;
}

export interface ScompAdapter {
  handleRequest(operation: string, payload: unknown): Promise<unknown>;
  addSubscriber(
    serviceId: string,
    handler: (delta: ConfigDelta) => void,
  ): Unsubscribe;
}

export function createScompAdapter(options: ScompAdapterOptions): ScompAdapter {
  const { configService } = options;

  async function handleRequest(
    operation: string,
    payload: unknown,
  ): Promise<unknown> {
    const p = payload as Record<string, unknown>;
    try {
      const tenantOpts = typeof p.tenantId === "string" ? { tenantId: p.tenantId } : {};
      const writeOpts: WriteContext = {
        ...(typeof p.environment === "string" ? { environment: p.environment } : {}),
        ...(typeof p.tenantId === "string" ? { tenantId: p.tenantId } : {}),
      };
      switch (operation) {
        case "resolveAll":
          return await configService.resolveAll(p.serviceId as string, tenantOpts);
        case "get": {
          const value = await configService.get(
            p.serviceId as string,
            p.key as string,
            tenantOpts,
          );
          return { value };
        }
        case "getNamespace": {
          const entries = await configService.getNamespace(
            p.serviceId as string,
            p.prefix as string,
            tenantOpts,
          );
          return { entries };
        }
        case "inspect":
          return await configService.inspect(
            p.serviceId as string,
            p.key as string,
          );
        case "set":
          return await configService.set(
            p.layer as string,
            p.key as string,
            p.value,
            writeOpts,
          );
        case "remove":
          return await configService.remove(
            p.layer as string,
            p.key as string,
            writeOpts,
          );
        case "promote":
        case "rollback":
        case "registerSchema":
          return { success: false, error: `Operation "${operation}" not yet implemented` };
        default:
          return createWeaverError(
            "VALIDATION_ERROR",
            `Unknown operation: ${operation}`,
          );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return createWeaverError("VALIDATION_ERROR", message);
    }
  }

  function addSubscriber(
    serviceId: string,
    handler: (delta: ConfigDelta) => void,
  ): Unsubscribe {
    return configService.onDelta((delta) => {
      // Service-scoped filtering: deliver all deltas for now
      // (service-level filtering would require delta to carry serviceId)
      handler(delta);
    });
  }

  return { handleRequest, addSubscriber };
}
