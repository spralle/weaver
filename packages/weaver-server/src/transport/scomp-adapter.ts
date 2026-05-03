// Scomp adapter — maps contract operations to WeaverConfigService
import type {
  WeaverConfigService,
  WriteContext,
} from "../core/config-service.js";
import { parseScopeQuery } from "../core/scope-utils.js";
import type { ConfigDelta } from "../types/index.js";
import { createWeaverError } from "../types/index.js";
import {
  getNamespacePayloadSchema,
  getPayloadSchema,
  inspectPayloadSchema,
  removePayloadSchema,
  resolveAllPayloadSchema,
  setPayloadSchema,
} from "./scomp-schemas.js";

type Unsubscribe = () => void;

export interface ScompAdapterOptions {
  configService: WeaverConfigService;
}

export interface ScompAdapter {
  handleRequest(operation: string, payload: unknown): Promise<unknown>;
  addSubscriber(handler: (delta: ConfigDelta) => void): Unsubscribe;
}

function validationError(message: string): { success: false; error: string } {
  return { success: false, error: `Invalid payload: ${message}` };
}

export function createScompAdapter(options: ScompAdapterOptions): ScompAdapter {
  const { configService } = options;

  async function handleResolveAll(payload: unknown): Promise<unknown> {
    const parsed = resolveAllPayloadSchema.safeParse(payload);
    if (!parsed.success) return validationError(parsed.error.message);
    const scopePath = parsed.data.scope
      ? parseScopeQuery(parsed.data.scope)
      : undefined;
    const scopeOpts = scopePath ? { scopePath } : {};
    return await configService.resolveAll(scopeOpts);
  }

  async function handleGet(payload: unknown): Promise<unknown> {
    const parsed = getPayloadSchema.safeParse(payload);
    if (!parsed.success) return validationError(parsed.error.message);
    const scopePath = parsed.data.scope
      ? parseScopeQuery(parsed.data.scope)
      : undefined;
    const scopeOpts = scopePath ? { scopePath } : {};
    const value = await configService.get(parsed.data.key, scopeOpts);
    return { value };
  }

  async function handleGetNamespace(payload: unknown): Promise<unknown> {
    const parsed = getNamespacePayloadSchema.safeParse(payload);
    if (!parsed.success) return validationError(parsed.error.message);
    const scopePath = parsed.data.scope
      ? parseScopeQuery(parsed.data.scope)
      : undefined;
    const scopeOpts = scopePath ? { scopePath } : {};
    const entries = await configService.getNamespace(
      parsed.data.prefix,
      scopeOpts,
    );
    return { entries };
  }

  async function handleInspect(payload: unknown): Promise<unknown> {
    const parsed = inspectPayloadSchema.safeParse(payload);
    if (!parsed.success) return validationError(parsed.error.message);
    return await configService.inspect(parsed.data.key);
  }

  async function handleSet(payload: unknown): Promise<unknown> {
    const parsed = setPayloadSchema.safeParse(payload);
    if (!parsed.success) return validationError(parsed.error.message);
    const { layer, key, value, scope, environment } = parsed.data;
    const scopePath = scope ? parseScopeQuery(scope) : undefined;
    const writeOpts: WriteContext = {
      ...(environment ? { environment } : {}),
      ...(scopePath ? { scopePath } : {}),
    };
    return await configService.set(layer, key, value, writeOpts);
  }

  async function handleRemove(payload: unknown): Promise<unknown> {
    const parsed = removePayloadSchema.safeParse(payload);
    if (!parsed.success) return validationError(parsed.error.message);
    const { layer, key, scope, environment } = parsed.data;
    const scopePath = scope ? parseScopeQuery(scope) : undefined;
    const writeOpts: WriteContext = {
      ...(environment ? { environment } : {}),
      ...(scopePath ? { scopePath } : {}),
    };
    return await configService.remove(layer, key, writeOpts);
  }

  async function handleRequest(
    operation: string,
    payload: unknown,
  ): Promise<unknown> {
    try {
      switch (operation) {
        case "resolveAll":
          return await handleResolveAll(payload);
        case "get":
          return await handleGet(payload);
        case "getNamespace":
          return await handleGetNamespace(payload);
        case "inspect":
          return await handleInspect(payload);
        case "set":
          return await handleSet(payload);
        case "remove":
          return await handleRemove(payload);
        case "promote":
        case "rollback":
        case "registerSchema":
          return {
            success: false,
            error: `Operation "${operation}" not yet implemented`,
          };
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

  function addSubscriber(handler: (delta: ConfigDelta) => void): Unsubscribe {
    return configService.onDelta((delta) => {
      handler(delta);
    });
  }

  return { handleRequest, addSubscriber };
}
