import type { TransportError } from "./http-transport";
import type { ConfigDelta } from "./types";

export interface SSEConnectionOptions {
  baseUrl: string;
  token: string | undefined;
  extraHeaders: Record<string, string> | undefined;
  fetchFn: typeof globalThis.fetch;
  maxReconnectAttempts: number;
  onError: ((error: TransportError) => void) | undefined;
}

export interface SSEConnection {
  readonly lastCheckpoint: number;
  readonly deltaHandlers: Set<(delta: ConfigDelta) => void>;
  connect(): void;
  disconnect(): void;
}

interface SSEState {
  abortController: AbortController | null;
  disposed: boolean;
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  lastCheckpoint: number;
}

export function createSSEConnection(
  options: SSEConnectionOptions,
): SSEConnection {
  const {
    baseUrl,
    token,
    extraHeaders,
    fetchFn,
    maxReconnectAttempts,
    onError,
  } = options;
  const deltaHandlers = new Set<(delta: ConfigDelta) => void>();

  const state: SSEState = {
    abortController: null,
    disposed: false,
    reconnectAttempts: 0,
    reconnectTimer: null,
    lastCheckpoint: 0,
  };

  function computeBackoffMs(): number {
    const base = 1000;
    const max = 32000;
    const delay = Math.min(base * 2 ** state.reconnectAttempts, max);
    return delay;
  }

  function scheduleReconnect(): void {
    if (state.disposed) return;
    if (state.reconnectAttempts >= maxReconnectAttempts) return;

    const delay = computeBackoffMs();
    state.reconnectAttempts++;
    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null;
      connect();
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
        onError?.({
          type: "parse",
          message: "Failed to parse SSE change event",
          retryable: false,
        });
      }
    } else if (eventType === "checkpoint") {
      state.lastCheckpoint = Date.now();
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

  function connect(): void {
    if (state.abortController) return;
    if (state.disposed) return;
    state.abortController = new AbortController();

    const sseHeaders: Record<string, string> = { Accept: "text/event-stream" };
    if (token) sseHeaders.Authorization = `Bearer ${token}`;
    if (extraHeaders) Object.assign(sseHeaders, extraHeaders);

    fetchFn(`${baseUrl}/v1/events`, {
      headers: sseHeaders,
      signal: state.abortController.signal,
    })
      .then((res) => {
        if (!res.body) return;
        state.reconnectAttempts = 0;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        function read(): void {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                state.abortController = null;
                scheduleReconnect();
                return;
              }
              buffer += decoder.decode(value, { stream: true });
              buffer = processBuffer(buffer);
              read();
            })
            .catch(() => {
              state.abortController = null;
              onError?.({
                type: "connection",
                message: "SSE stream read error",
                retryable: true,
              });
              scheduleReconnect();
            });
        }

        read();
      })
      .catch(() => {
        state.abortController = null;
        onError?.({
          type: "connection",
          message: "SSE connection failed",
          retryable: true,
        });
        scheduleReconnect();
      });
  }

  function disconnect(): void {
    state.disposed = true;
    if (state.reconnectTimer !== null) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    if (state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }
  }

  return {
    get lastCheckpoint() {
      return state.lastCheckpoint;
    },
    deltaHandlers,
    connect() {
      state.disposed = false;
      state.reconnectAttempts = 0;
      connect();
    },
    disconnect,
  };
}
