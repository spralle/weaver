import type { ScopeDefinition, ScopeInstance, WeaverErrorCode } from "@weaver/config-types";
import type { ConfigDelta, GetOptions, ResolveOptions, Unsubscribe, ConfigSnapshot } from "./types.js";

export interface WriteOptions {
  layer?: string;
  environment?: string;
  ifRevision?: string;
}

export interface WriteResult {
  success: boolean;
  revision?: string;
  error?: { code: WeaverErrorCode | string; message: string; details?: Record<string, unknown> };
}

export interface WeaverTransport {
  // Reads
  resolveAll(options?: ResolveOptions): Promise<ConfigSnapshot>;
  get(key: string, options?: GetOptions): Promise<unknown>;
  getNamespace(prefix: string, options?: GetOptions): Promise<Record<string, unknown>>;
  inspect(key: string): Promise<unknown>;
  subscribe(handler: (delta: ConfigDelta) => void): Unsubscribe;

  // Writes
  set(key: string, value: unknown, options?: WriteOptions): Promise<WriteResult>;
  setMany(entries: Record<string, unknown>, options?: WriteOptions): Promise<WriteResult>;
  remove(key: string, options?: WriteOptions): Promise<WriteResult>;

  // Scopes
  listScopes(): Promise<ScopeDefinition[]>;
  listScopeValues(scopeId: string, parentScope?: ScopeInstance[]): Promise<string[]>;

  // Lifecycle
  close(): Promise<void>;
}
