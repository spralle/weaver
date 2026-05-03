import type { ScopeDefinition, ScopeInstance } from "@weaver/config-types";
import type { ConfigDelta, ConfigSnapshot, GetOptions, ResolveOptions, Unsubscribe } from "./types.js";
import type { WeaverTransport, WriteOptions, WriteResult } from "./transport.js";

export interface HttpTransportOptions {
  /** Base URL of the weaver-server (e.g. "http://localhost:3399") */
  baseUrl: string;
  /** Auth token (JWT) — injected into Authorization header */
  token?: string;
  /** Additional headers for all requests */
  headers?: Record<string, string>;
  /** Custom fetch implementation (defaults to global fetch) */
  fetch?: typeof globalThis.fetch;
}

export function createHttpTransport(options: HttpTransportOptions): WeaverTransport {
  const { baseUrl, token, headers: extraHeaders } = options;
  const fetchFn = options.fetch ?? globalThis.fetch;
  let abortController: AbortController | null = null;
  const deltaHandlers = new Set<(delta: ConfigDelta) => void>();

  function buildHeaders(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };
    if (token) {
      h["Authorization"] = `Bearer ${token}`;
    }
    return h;
  }

  function buildScopeQuery(scopePath?: ScopeInstance[]): string {
    if (!scopePath?.length) return "";
    return scopePath.map((s) => `${s.scopeId}:${s.value}`).join("/");
  }

  function queryString(params: Record<string, string | undefined>): string {
    const entries = Object.entries(params).filter(
      (pair): pair is [string, string] => pair[1] !== undefined,
    );
    if (entries.length === 0) return "";
    return "?" + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetchFn(`${baseUrl}${path}`, {
      method,
      headers: buildHeaders(),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = (await res.json()) as {
      data: T;
      meta: { revision: string };
      error?: { code: string; message: string };
    };
    if (!res.ok && json.error) {
      throw new Error(`[${json.error.code}] ${json.error.message}`);
    }
    return json.data;
  }

  function connectSSE(): void {
    if (abortController) return;
    abortController = new AbortController();

    const sseHeaders: Record<string, string> = { Accept: "text/event-stream" };
    if (token) sseHeaders["Authorization"] = `Bearer ${token}`;
    if (extraHeaders) Object.assign(sseHeaders, extraHeaders);

    fetchFn(`${baseUrl}/v1/events`, {
      headers: sseHeaders,
      signal: abortController.signal,
    })
      .then((res) => {
        if (!res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        function read(): void {
          reader.read().then(({ done, value }) => {
            if (done) return;
            buffer += decoder.decode(value, { stream: true });
            processBuffer();
            read();
          }).catch(() => { /* aborted */ });
        }

        function processBuffer(): void {
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          let currentEvent = "";
          let currentData = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              currentData = line.slice(6);
            } else if (line === "") {
              if (currentEvent === "change" && currentData) {
                try {
                  const delta = JSON.parse(currentData) as ConfigDelta;
                  for (const handler of deltaHandlers) {
                    handler(delta);
                  }
                } catch { /* skip invalid JSON */ }
              }
              currentEvent = "";
              currentData = "";
            }
          }
        }

        read();
      })
      .catch(() => { /* connection failed */ });
  }

  function disconnectSSE(): void {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  return {
    async resolveAll(opts?: ResolveOptions): Promise<ConfigSnapshot> {
      const scope = buildScopeQuery(opts?.scopePath);
      const qs = queryString({ scope: scope || undefined });
      return request<ConfigSnapshot>("GET", `/v1/config${qs}`);
    },

    async get(key: string, opts?: GetOptions): Promise<unknown> {
      const scope = buildScopeQuery(opts?.scopePath);
      const keyPath = key.replace(/\./g, "/");
      const qs = queryString({ scope: scope || undefined });
      const result = await request<{ key: string; value: unknown }>("GET", `/v1/config/${keyPath}${qs}`);
      return result.value;
    },

    async getNamespace(prefix: string, opts?: GetOptions): Promise<Record<string, unknown>> {
      const scope = buildScopeQuery(opts?.scopePath);
      const keyPath = prefix.replace(/\./g, "/");
      const qs = queryString({ scope: scope || undefined });
      const result = await request<{ key: string; value: unknown }>("GET", `/v1/config/${keyPath}${qs}`);
      if (result.value && typeof result.value === "object" && !Array.isArray(result.value)) {
        return result.value as Record<string, unknown>;
      }
      return {};
    },

    async inspect(key: string): Promise<unknown> {
      const keyPath = key.replace(/\./g, "/");
      return request<unknown>("GET", `/v1/config/${keyPath}?inspect`);
    },

    subscribe(handler: (delta: ConfigDelta) => void): Unsubscribe {
      deltaHandlers.add(handler);
      if (deltaHandlers.size === 1) {
        connectSSE();
      }
      return () => {
        deltaHandlers.delete(handler);
        if (deltaHandlers.size === 0) {
          disconnectSSE();
        }
      };
    },

    async set(key: string, value: unknown, opts?: WriteOptions): Promise<WriteResult> {
      const keyPath = key.replace(/\./g, "/");
      const qs = queryString({ layer: opts?.layer, env: opts?.environment });
      const headers = buildHeaders();
      if (opts?.ifRevision) {
        headers["If-Match"] = `"${opts.ifRevision}"`;
      }
      const res = await fetchFn(`${baseUrl}/v1/config/${keyPath}${qs}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ value }),
      });
      const json = (await res.json()) as {
        data: WriteResult;
        error?: { code: string; message: string; details?: Record<string, unknown> };
      };
      if (!res.ok && json.error) {
        return { success: false, error: json.error };
      }
      return json.data;
    },

    async setMany(entries: Record<string, unknown>, opts?: WriteOptions): Promise<WriteResult> {
      const qs = queryString({ layer: opts?.layer, env: opts?.environment });
      const headers = buildHeaders();
      if (opts?.ifRevision) {
        headers["If-Match"] = `"${opts.ifRevision}"`;
      }
      const res = await fetchFn(`${baseUrl}/v1/config${qs}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ entries }),
      });
      const json = (await res.json()) as {
        data: WriteResult;
        error?: { code: string; message: string; details?: Record<string, unknown> };
      };
      if (!res.ok && json.error) {
        return { success: false, error: json.error };
      }
      return json.data;
    },

    async remove(key: string, opts?: WriteOptions): Promise<WriteResult> {
      const keyPath = key.replace(/\./g, "/");
      const qs = queryString({ layer: opts?.layer, env: opts?.environment });
      const headers = buildHeaders();
      if (opts?.ifRevision) {
        headers["If-Match"] = `"${opts.ifRevision}"`;
      }
      const res = await fetchFn(`${baseUrl}/v1/config/${keyPath}${qs}`, {
        method: "DELETE",
        headers,
      });
      const json = (await res.json()) as {
        data: WriteResult;
        error?: { code: string; message: string; details?: Record<string, unknown> };
      };
      if (!res.ok && json.error) {
        return { success: false, error: json.error };
      }
      return json.data;
    },

    async listScopes(): Promise<ScopeDefinition[]> {
      const result = await request<{ definitions: ScopeDefinition[] }>("GET", "/v1/scopes");
      return result.definitions;
    },

    async listScopeValues(scopeId: string): Promise<string[]> {
      const result = await request<{ values: string[] }>("GET", `/v1/scopes/${encodeURIComponent(scopeId)}`);
      return result.values;
    },

    async close(): Promise<void> {
      disconnectSSE();
      deltaHandlers.clear();
    },
  };
}
