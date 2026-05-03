// SSE transport adapter — streams config deltas to connected clients
import type { WeaverConfigService } from "../core/config-service.js";
import type { ConfigDelta } from "../types/index.js";
import { matchGlob } from "./glob-matcher.js";

export interface SSEAdapterOptions {
  configService: WeaverConfigService;
}

export interface SSEClient {
  readonly id: string;
  readonly keyPatterns: string[];
  send(delta: ConfigDelta): void;
  close(): void;
}

export interface SSEAdapter {
  createClient(keyPatterns?: string[]): SSEClient;
  removeClient(client: SSEClient): void;
  readonly clientCount: number;
  closeAll(): void;
}

let clientIdCounter = 0;

export function createSSEAdapter(options: SSEAdapterOptions): SSEAdapter {
  const { configService } = options;
  const clients = new Set<SSEClient & { unsubscribe: () => void }>();

  function createClient(
    keyPatterns?: string[],
  ): SSEClient {
    const patterns = keyPatterns ?? ["**"];
    const messages: string[] = [];
    let closed = false;
    const id = `sse-${++clientIdCounter}`;

    function shouldDeliver(delta: ConfigDelta): boolean {
      return patterns.some((p) => matchGlob(p, delta.key));
    }

    const unsubscribe = configService.onDelta((delta) => {
      if (closed) return;
      if (shouldDeliver(delta)) {
        client.send(delta);
      }
    });

    const client = {
      id,
      keyPatterns: patterns,
      unsubscribe,
      send(delta: ConfigDelta): void {
        if (closed) return;
        messages.push(`data: ${JSON.stringify(delta)}\n\n`);
      },
      close(): void {
        if (closed) return;
        closed = true;
        unsubscribe();
        clients.delete(client);
      },
    };

    clients.add(client);
    return client;
  }

  function removeClient(client: SSEClient): void {
    client.close();
  }

  function closeAll(): void {
    for (const client of [...clients]) {
      client.close();
    }
  }

  return {
    createClient,
    removeClient,
    get clientCount() {
      return clients.size;
    },
    closeAll,
  };
}
