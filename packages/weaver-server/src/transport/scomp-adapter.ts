// Scomp adapter — maps contract operations to WeaverConfigService
import type { WeaverConfigService, WriteContext } from "../core/config-service.js";
import type { ConfigDelta } from "../types/index.js";
import { createWeaverError } from "../types/index.js";
import { parseScopeQuery } from "../core/scope-utils.js";

type Unsubscribe = () => void;

export interface ScompAdapterOptions {
  configService: WeaverConfigService;
}

export interface ScompAdapter {
  handleRequest(operation: string, payload: unknown): Promise<unknown>;
  addSubscriber(
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
      const scopePath = typeof p.scope === "string" ? parseScopeQuery(p.scope) : undefined;
      const scopeOpts = scopePath ? { scopePath } : {};
      const writeOpts: WriteContext = {
        ...(typeof p.environment === "string" ? { environment: p.environment } : {}),
        ...(scopePath ? { scopePath } : {}),
      };
      switch (operation) {
        case "resolveAll":
          return await configService.resolveAll(scopeOpts);
        case "get": {
          const value = await configService.get(
            p.key as string,
            scopeOpts,
          );
          return { value };
        }
        case "getNamespace": {
          const entries = await configService.getNamespace(
            p.prefix as string,
            scopeOpts,
          );
          return { entries };
        }
        case "inspect":
          return await configService.inspect(
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
    handler: (delta: ConfigDelta) => void,
  ): Unsubscribe {
    return configService.onDelta((delta) => {
      handler(delta);
    });
  }

  return { handleRequest, addSubscriber };
}
