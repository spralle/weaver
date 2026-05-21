import type { ScopeDefinition, ScopeInstance } from "@weaver/config-types";
import type {
  WeaverTransport,
  WriteOptions,
  WriteResult,
} from "./transport.js";
import type {
  ConfigDelta,
  ConfigSnapshot,
  GetOptions,
  ResolveOptions,
  Unsubscribe,
} from "./types.js";

export interface HttpTransportOptions {
  /** Base URL of the weaver-server (e.g. "http://localhost:3399") */
  baseUrl: string;
  /** Auth token (JWT) — injected into Authorization header */
  token?: string;
  /** Additional headers for all requests */
  headers?: Record<string, string>;
  /** Custom fetch implementation (defaults to global fetch) */
  fetch?: typeof globalThis.fetch;
  /** Maximum reconnection attempts for SSE (default: Infinity) */
  maxReconnectAttempts?: number;
}

interface SSEState {
  abortController: AbortController | null;
  disposed: boolean;
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  lastCheckpoint: number;
}

export function createHttpTransport(
  options: HttpTransportOptions,
): WeaverTransport & { lastCheckpoint: number } {
  const { baseUrl, token, headers: extraHeaders } = options;
  const fetchFn = options.fetch ?? globalThis.fetch;
  const maxReconnectAttempts = options.maxReconnectAttempts ?? Infinity;

  const deltaHandlers = new Set<(delta: ConfigDelta) => void>();
  const snapshotHandlers = new Set<(snapshot: ConfigSnapshot) => void>();

  const sse: SSEState = {
    abortController: null,
    disposed: false,
    reconnectAttempts: 0,
    reconnectTimer: null,
    lastCheckpoint: 0,
  };

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
    return (
      "?" +
      entries
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")
    );
  }

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetchFn(`${baseUrl}${path}`, {
      method,
      headers: buildHeaders(),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    // SAFETY: server API contract guarantees this response shape
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

  function computeBackoffMs(): number {
    const base = 1000;
    const max = 32000;
    const delay = Math.min(base * 2 ** sse.reconnectAttempts, max);
    return delay;
  }

  function scheduleReconnect(): void {
    if (sse.disposed) return;
    if (sse.reconnectAttempts >= maxReconnectAttempts) return;

    const delay = computeBackoffMs();
    sse.reconnectAttempts++;
    sse.reconnectTimer = setTimeout(() => {
      sse.reconnectTimer = null;
      connectSSE();
    }, delay);
  }

  function processSSEEvent(eventType: string, data: string): void {
    if (eventType === "change" && data) {
      try {
        const delta = JSON.parse(data) as ConfigDelta; // SAFETY: SSE event data matches ConfigDelta schema
        for (const handler of deltaHandlers) {
          handler(delta);
        }
      } catch {
        /* skip invalid JSON */
      }
    } else if (eventType === "snapshot" && data) {
      try {
        const snapshot = JSON.parse(data) as ConfigSnapshot; // SAFETY: SSE snapshot event matches ConfigSnapshot schema
        for (const handler of snapshotHandlers) {
          handler(snapshot);
        }
      } catch {
        /* skip invalid JSON */
      }
    } else if (eventType === "checkpoint") {
      sse.lastCheckpoint = Date.now();
    }
  }

  function processBuffer(buffer: string): string {
    const lines = buffer.split("\n");
    const remainder = lines.pop() ?? "";
    let currentEvent = "";
    let currentData = "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        currentData = line.slice(6);
      } else if (line === "") {
        processSSEEvent(currentEvent, currentData);
        currentEvent = "";
        currentData = "";
      }
    }
    return remainder;
  }

  function connectSSE(): void {
    if (sse.abortController) return;
    if (sse.disposed) return;
    sse.abortController = new AbortController();

    const sseHeaders: Record<string, string> = { Accept: "text/event-stream" };
    if (token) sseHeaders["Authorization"] = `Bearer ${token}`;
    if (extraHeaders) Object.assign(sseHeaders, extraHeaders);

    fetchFn(`${baseUrl}/v1/events`, {
      headers: sseHeaders,
      signal: sse.abortController.signal,
    })
      .then((res) => {
        if (!res.body) return;
        sse.reconnectAttempts = 0;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        function read(): void {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                sse.abortController = null;
                scheduleReconnect();
                return;
              }
              buffer += decoder.decode(value, { stream: true });
              buffer = processBuffer(buffer);
              read();
            })
            .catch(() => {
              sse.abortController = null;
              scheduleReconnect();
            });
        }

        read();
      })
      .catch(() => {
        sse.abortController = null;
        scheduleReconnect();
      });
  }

  function disconnectSSE(): void {
    sse.disposed = true;
    if (sse.reconnectTimer !== null) {
      clearTimeout(sse.reconnectTimer);
      sse.reconnectTimer = null;
    }
    if (sse.abortController) {
      sse.abortController.abort();
      sse.abortController = null;
    }
  }

  return {
    get lastCheckpoint() {
      return sse.lastCheckpoint;
    },

    async resolveAll(opts?: ResolveOptions): Promise<ConfigSnapshot> {
      const scope = buildScopeQuery(opts?.scopePath);
      const qs = queryString({ scope: scope || undefined });
      return request<ConfigSnapshot>("GET", `/v1/config${qs}`);
    },

    async get(key: string, opts?: GetOptions): Promise<unknown> {
      const scope = buildScopeQuery(opts?.scopePath);
      const keyPath = key.replace(/\./g, "/");
      const qs = queryString({ scope: scope || undefined });
      const result = await request<{ key: string; value: unknown }>(
        "GET",
        `/v1/config/${keyPath}${qs}`,
      );
      return result.value;
    },

    async getNamespace(
      prefix: string,
      opts?: GetOptions,
    ): Promise<Record<string, unknown>> {
      const scope = buildScopeQuery(opts?.scopePath);
      const keyPath = prefix.replace(/\./g, "/");
      const qs = queryString({ scope: scope || undefined });
      const result = await request<{ key: string; value: unknown }>(
        "GET",
        `/v1/config/${keyPath}${qs}`,
      );
      if (
        result.value &&
        typeof result.value === "object" &&
        !Array.isArray(result.value)
      ) {
        return result.value as Record<string, unknown>; // SAFETY: guarded by typeof/null/array checks
      }
      return {};
    },

    async inspect(key: string): Promise<unknown> {
      const keyPath = key.replace(/\./g, "/");
      return request<unknown>("GET", `/v1/config/${keyPath}?inspect`);
    },

    subscribe(handler: (delta: ConfigDelta) => void): Unsubscribe {
      deltaHandlers.add(handler);
      if (deltaHandlers.size === 1 && snapshotHandlers.size === 0) {
        sse.disposed = false;
        sse.reconnectAttempts = 0;
        connectSSE();
      }
      return () => {
        deltaHandlers.delete(handler);
        if (deltaHandlers.size === 0 && snapshotHandlers.size === 0) {
          disconnectSSE();
        }
      };
    },

    async set(
      key: string,
      value: unknown,
      opts?: WriteOptions,
    ): Promise<WriteResult> {
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
      // SAFETY: server API contract guarantees this response shape
      const json = (await res.json()) as {
        data: WriteResult;
        error?: {
          code: string;
          message: string;
          details?: Record<string, unknown>;
        };
      };
      if (!res.ok && json.error) {
        return { success: false, error: json.error };
      }
      return json.data;
    },

    async setMany(
      entries: Record<string, unknown>,
      opts?: WriteOptions,
    ): Promise<WriteResult> {
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
      // SAFETY: server API contract guarantees this response shape
      const json = (await res.json()) as {
        data: WriteResult;
        error?: {
          code: string;
          message: string;
          details?: Record<string, unknown>;
        };
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
      // SAFETY: server API contract guarantees this response shape
      const json = (await res.json()) as {
        data: WriteResult;
        error?: {
          code: string;
          message: string;
          details?: Record<string, unknown>;
        };
      };
      if (!res.ok && json.error) {
        return { success: false, error: json.error };
      }
      return json.data;
    },

    async listScopes(): Promise<ScopeDefinition[]> {
      const result = await request<{ definitions: ScopeDefinition[] }>(
        "GET",
        "/v1/scopes",
      );
      return result.definitions;
    },

    async listScopeValues(scopeId: string): Promise<string[]> {
      const result = await request<{ values: string[] }>(
        "GET",
        `/v1/scopes/${encodeURIComponent(scopeId)}`,
      );
      return result.values;
    },

    async close(): Promise<void> {
      disconnectSSE();
      deltaHandlers.clear();
      snapshotHandlers.clear();
    },
  };
}
