import type { WeaverTransport, WriteOptions, WriteResult } from "./transport";
import type { ConfigDelta, Unsubscribe } from "./types";

/**
 * Lifecycle hooks for intercepting transport operations.
 * Use with `withMiddleware()` to add logging, metrics, or custom behavior.
 */
export interface TransportMiddleware {
  onBeforeGet?(key: string): void;
  onAfterGet?(key: string, value: unknown): void;
  onBeforeSet?(key: string, value: unknown): void;
  onAfterSet?(key: string, result: WriteResult): void;
  onError?(method: string, error: unknown): void;
  onDelta?(delta: ConfigDelta): void;
}

/**
 * Wraps a transport with one or more middleware hooks for observability and control.
 *
 * @param transport - The base transport to wrap
 * @param middlewares - Middleware instances whose hooks are called in order
 * @returns A new transport that delegates to the original with middleware applied
 *
 * @example
 * ```ts
 * const logged = withMiddleware(transport, {
 *   onBeforeGet(key) { console.log("reading", key); },
 * });
 * ```
 */
export function withMiddleware(
  transport: WeaverTransport,
  ...middlewares: TransportMiddleware[]
): WeaverTransport {
  return {
    ...transport,

    async get(key, options) {
      for (const mw of middlewares) mw.onBeforeGet?.(key);
      try {
        const value = await transport.get(key, options);
        for (const mw of middlewares) mw.onAfterGet?.(key, value);
        return value;
      } catch (err) {
        for (const mw of middlewares) mw.onError?.("get", err);
        throw err;
      }
    },

    async set(key, value, options) {
      for (const mw of middlewares) mw.onBeforeSet?.(key, value);
      try {
        const result = await transport.set(key, value, options);
        for (const mw of middlewares) mw.onAfterSet?.(key, result);
        return result;
      } catch (err) {
        for (const mw of middlewares) mw.onError?.("set", err);
        throw err;
      }
    },

    async setMany(entries, options) {
      try {
        return await transport.setMany(entries, options);
      } catch (err) {
        for (const mw of middlewares) mw.onError?.("setMany", err);
        throw err;
      }
    },

    async remove(key, options) {
      try {
        return await transport.remove(key, options);
      } catch (err) {
        for (const mw of middlewares) mw.onError?.("remove", err);
        throw err;
      }
    },

    subscribe(handler: (delta: ConfigDelta) => void): Unsubscribe {
      return transport.subscribe((delta) => {
        for (const mw of middlewares) mw.onDelta?.(delta);
        handler(delta);
      });
    },
  };
}
