import type { ScopeInstance } from "@weaver-conf/config-types";
import type { ZodObject, ZodRawShape, ZodType } from "zod";
import { z } from "zod";
import type { WriteOptions, WriteResult } from "./transport";
import type { ConfigDelta, Unsubscribe } from "./types";

// ─── Namespace Declaration ────────────────────────────────

/** Definition of a typed config namespace — prefix + Zod schema shape. */
export interface NamespaceDefinition<
  TPrefix extends string = string,
  TShape extends ZodRawShape = ZodRawShape,
> {
  readonly prefix: TPrefix;
  readonly schema: ZodObject<TShape>;
}

/**
 * Declare a typed config namespace with a Zod shape.
 * Supports nested shapes matching the canonical nested JSON storage model.
 */
export function defineNamespace<
  TPrefix extends string,
  TShape extends ZodRawShape,
>(prefix: TPrefix, shape: TShape): NamespaceDefinition<TPrefix, TShape> {
  // Safe cast: z.object(shape) returns ZodObject<TShape> but TS infers a wider type
  return { prefix, schema: z.object(shape) as ZodObject<TShape> }; // SAFETY: z.object(shape) produces ZodObject<TShape> but TS can't infer it
}

// ─── TypedNamespaceClient ─────────────────────────────────

export interface TypedNamespaceClient<TShape extends ZodRawShape> {
  get<K extends keyof TShape & string>(key: K): z.infer<TShape[K]> | undefined;

  getOrDefault<K extends keyof TShape & string>(
    key: K,
    defaultValue: z.infer<TShape[K]>,
  ): z.infer<TShape[K]>;

  getAll(): Partial<{ [K in keyof TShape & string]: z.infer<TShape[K]> }>;

  set<K extends keyof TShape & string>(
    key: K,
    value: z.infer<TShape[K]>,
    opts?: WriteOptions,
  ): Promise<WriteResult>;

  onChange<K extends keyof TShape & string>(
    key: K,
    handler: (value: z.infer<TShape[K]>) => void,
  ): Unsubscribe;
  onChange(handler: (deltas: ConfigDelta[]) => void): Unsubscribe;

  withScope(scopePath: ScopeInstance[]): TypedNamespaceClient<TShape>;
  instance(instanceId: string): TypedInstanceClient<TShape>;
}

// ─── TypedInstanceClient ──────────────────────────────────

export interface TypedInstanceClient<TShape extends ZodRawShape> {
  get<K extends keyof TShape & string>(key: K): z.infer<TShape[K]> | undefined;

  getOrDefault<K extends keyof TShape & string>(
    key: K,
    defaultValue: z.infer<TShape[K]>,
  ): z.infer<TShape[K]>;

  set<K extends keyof TShape & string>(
    key: K,
    value: z.infer<TShape[K]>,
  ): Promise<WriteResult>;

  reset(): Promise<WriteResult>;

  onChange<K extends keyof TShape & string>(
    key: K,
    handler: (value: z.infer<TShape[K]>) => void,
  ): Unsubscribe;
}

// ─── UntypedNamespaceClient ───────────────────────────────

export interface UntypedNamespaceClient {
  get<T = unknown>(key: string, schema?: ZodType<T>): T | undefined;
  getOrDefault<T = unknown>(key: string, defaultValue: T): T;
  getAll(): Record<string, unknown>;

  set<T = unknown>(
    key: string,
    value: T,
    opts?: WriteOptions,
  ): Promise<WriteResult>;

  setMany(
    entries: Record<string, unknown>,
    opts?: WriteOptions,
  ): Promise<WriteResult>;

  remove(key: string, opts?: WriteOptions): Promise<WriteResult>;

  onChange(
    pattern: string,
    handler: (deltas: ConfigDelta[]) => void,
  ): Unsubscribe;

  withScope(scopePath: ScopeInstance[]): UntypedNamespaceClient;
  instance(instanceId: string): InstanceClient;
}

// ─── InstanceClient (untyped) ─────────────────────────────

export interface InstanceClient {
  get<T = unknown>(key: string, schema?: ZodType<T>): T | undefined;
  getOrDefault<T = unknown>(key: string, defaultValue: T): T;
  set<T = unknown>(key: string, value: T): Promise<WriteResult>;
  reset(): Promise<WriteResult>;
  onChange(
    pattern: string,
    handler: (deltas: ConfigDelta[]) => void,
  ): Unsubscribe;
}
