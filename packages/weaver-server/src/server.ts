// Weaver server entry point — orchestrates all subsystems

import type { ConfigurationStorageProvider } from "@weaver-conf/config-types";
import { createAuditService, createStdoutAuditSink } from "./audit/index.js";
import { createWeaverConfigService } from "./core/config-service.js";
import type { HealthEndpoints } from "./health.js";
import { createHealthEndpoints } from "./health.js";
import { createInMemoryStorageProvider } from "./providers/index.js";
import { parseServerEnv } from "./server-env.js";
import { createShutdownManager } from "./shutdown.js";
import type { RestAdapter } from "./transport/rest-adapter.js";
import { createRestAdapter } from "./transport/rest-adapter.js";
import type { SSEAdapter, SSEClient } from "./transport/sse-adapter.js";
import { createSSEAdapter } from "./transport/sse-adapter.js";
import type { SSEMessage } from "./transport/sse-events.js";

declare const Bun: {
  serve(options: {
    port: number;
    fetch: (req: Request) => Response | Promise<Response>;
  }): {
    port: number;
    stop(): void;
  };
};

export interface WeaverServerOptions {
  port?: number;
  repoUrl?: string;
  environment?: string;
  gitToken?: string;
  mongoUri?: string;
  jwtSecret?: string;
  adminRoles?: string[];
  corsOrigins?: string[];
  providers?: ConfigurationStorageProvider[];
}

export interface WeaverServer {
  readonly port: number;
  readonly isReady: boolean;
  close(): Promise<void>;
}

function resolveOptions(options?: WeaverServerOptions) {
  const env = parseServerEnv(process.env);
  return {
    port: options?.port ?? env.WEAVER_PORT ?? 3399,
    repoUrl: options?.repoUrl ?? env.WEAVER_CONFIG_REPO ?? "",
    environment:
      options?.environment ?? env.WEAVER_ENVIRONMENT ?? "development",
    gitToken: options?.gitToken ?? env.WEAVER_GIT_TOKEN,
    mongoUri: options?.mongoUri ?? env.WEAVER_MONGO_URI,
    jwtSecret: options?.jwtSecret ?? env.WEAVER_JWT_SECRET,
    adminRoles: options?.adminRoles ?? ["admin"],
    corsOrigins: options?.corsOrigins,
    providers: options?.providers,
  };
}

function createRequestHandler(
  health: HealthEndpoints,
  restAdapter: RestAdapter,
  sseAdapter: SSEAdapter,
) {
  return async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method;

    if (url.pathname === "/healthz") {
      const result = health.healthz();
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.pathname === "/readyz") {
      const result = health.readyz();
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.pathname === "/v1/events" && method === "GET") {
      return handleSSE(url, sseAdapter);
    }

    if (url.pathname.startsWith("/v1/")) {
      return handleRest(req, url, method, restAdapter);
    }

    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  };
}

async function handleRest(
  req: Request,
  url: URL,
  method: string,
  restAdapter: RestAdapter,
): Promise<Response> {
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  let body: unknown;
  if (method !== "GET" && method !== "HEAD") {
    try {
      body = await req.json();
    } catch {
      body = undefined;
    }
  }

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const restResponse = await restAdapter.handleRequest(method, url.pathname, {
    params: {},
    query,
    body,
    headers,
  });

  return new Response(JSON.stringify(restResponse.body), {
    status: restResponse.status,
    headers: restResponse.headers ?? { "content-type": "application/json" },
  });
}

async function handleSSE(url: URL, sseAdapter: SSEAdapter): Promise<Response> {
  const clientOptions: Record<string, string> = {};
  const prefix = url.searchParams.get("prefix");
  const scope = url.searchParams.get("scope");
  const since = url.searchParams.get("since");
  if (prefix) clientOptions["prefix"] = prefix;
  if (scope) clientOptions["scope"] = scope;
  if (since) clientOptions["since"] = since;

  const client = await sseAdapter.createClient(clientOptions);

  const stream = new ReadableStream({
    start(controller) {
      for (const msg of client.messages) {
        controller.enqueue(new TextEncoder().encode(msg));
      }

      const originalSend = client.send.bind(client);
      Object.defineProperty(client, "send", {
        value(message: SSEMessage) {
          originalSend(message);
          const formatted = client.messages[client.messages.length - 1];
          if (formatted) {
            try {
              controller.enqueue(new TextEncoder().encode(formatted));
            } catch {
              client.close();
            }
          }
        },
        writable: true,
        configurable: true,
      });
    },
    cancel() {
      client.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function startWeaverServer(
  options?: WeaverServerOptions,
): Promise<WeaverServer> {
  const config = resolveOptions(options);

  const health = createHealthEndpoints();
  const shutdownManager = createShutdownManager({ drainTimeoutMs: 10_000 });

  const auditService = createAuditService({
    sinks: [createStdoutAuditSink()],
  });

  const inputProviders = config.providers ?? [
    createInMemoryStorageProvider({ id: "default", layer: "platform" }),
  ];

  const configService = await createWeaverConfigService({
    providers: inputProviders,
    environment: config.environment,
  });

  const restAdapterOptions: {
    configService: typeof configService;
    corsOrigins?: string[];
  } = {
    configService,
  };
  if (config.corsOrigins) {
    restAdapterOptions.corsOrigins = config.corsOrigins;
  }

  const restAdapter = createRestAdapter(restAdapterOptions);

  const sseAdapter = createSSEAdapter({ configService });
  sseAdapter.startCheckpointTimer();

  const handleRequest = createRequestHandler(health, restAdapter, sseAdapter);

  const server = Bun.serve({
    port: config.port,
    fetch: handleRequest,
  });

  health.setDegradedInfo({
    degradedProviders: configService.degradedProviders,
    totalProviders: inputProviders.length,
  });
  health.setReady(true);

  shutdownManager.onShutdown(async () => {
    health.setReady(false);
    await configService.flush();
    sseAdapter.stopCheckpointTimer();
    sseAdapter.closeAll();
    server.stop();
  });

  return {
    get port() {
      return server.port;
    },
    get isReady() {
      return health.readyz().status === 200;
    },
    async close() {
      await shutdownManager.shutdown();
    },
  };
}
