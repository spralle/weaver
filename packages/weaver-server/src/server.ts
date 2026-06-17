// Weaver server entry point — orchestrates all subsystems

import { withAuth } from "@weaver-conf/config-auth";
import type {
  ConfigurationStorageProvider,
  WeaverConfig,
} from "@weaver-conf/config-types";
import type { AuthContext, AuthMiddleware } from "./auth/auth-middleware";
import { createAuthMiddleware } from "./auth/auth-middleware";
import { createJwtValidator } from "./auth/jwt-validator";
import { resolveServerBootstrap } from "./bootstrap/server-bootstrap";
import { createWeaverConfigService } from "./core/config-service";
import type { HealthEndpoints } from "./health";
import { createHealthEndpoints } from "./health";
import { parseServerEnv } from "./server-env";
import { createShutdownManager } from "./shutdown";
import type { AuthGate } from "./transport/auth-gate";
import { createAuthGate } from "./transport/auth-gate";
import type { RestAdapter, RestRequest } from "./transport/rest-adapter";
import { createRestAdapter } from "./transport/rest-adapter";
import type { SSEAdapter } from "./transport/sse-adapter";
import { createSSEAdapter } from "./transport/sse-adapter";
import type { SSEMessage } from "./transport/sse-events";

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
  readonly authEnabled: boolean;
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
  authMiddleware?: AuthMiddleware,
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
      return handleRest(req, url, method, restAdapter, authMiddleware);
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
  authMiddleware?: AuthMiddleware,
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

  const authResult = await authenticateRestRequest(
    method,
    headers,
    authMiddleware,
  );
  if (authResult instanceof Response) {
    return authResult;
  }

  const restRequest: RestRequest = {
    params: {},
    query,
    body,
    headers,
    ...(authResult ? { authContext: authResult } : {}),
  };

  const restResponse = await restAdapter.handleRequest(
    method,
    url.pathname,
    restRequest,
  );

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
  if (prefix) clientOptions.prefix = prefix;
  if (scope) clientOptions.scope = scope;
  if (since) clientOptions.since = since;

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

function isWriteMethod(method: string): boolean {
  return (
    method === "POST" ||
    method === "PUT" ||
    method === "PATCH" ||
    method === "DELETE"
  );
}

function unauthorized(message: string): Response {
  return new Response(
    JSON.stringify({ error: { code: "UNAUTHORIZED", message } }),
    { status: 401, headers: { "content-type": "application/json" } },
  );
}

async function authenticateRestRequest(
  method: string,
  headers: Record<string, string>,
  authMiddleware?: AuthMiddleware,
): Promise<AuthContext | Response | undefined> {
  if (!authMiddleware) return undefined;

  const token = authMiddleware.extractToken(headers);
  if (!token && !isWriteMethod(method)) return undefined;

  try {
    return await authMiddleware.authenticate(token);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return unauthorized(message);
  }
}

export async function startWeaverServer(
  options?: WeaverServerOptions,
): Promise<WeaverServer> {
  const config = resolveOptions(options);

  const health = createHealthEndpoints();
  const shutdownManager = createShutdownManager({ drainTimeoutMs: 10_000 });

  const bootstrapResult = await resolveServerBootstrap(config);
  const inputProviders = bootstrapResult.providers;

  let configService: Awaited<ReturnType<typeof createWeaverConfigService>>;
  try {
    configService = await createWeaverConfigService({
      providers: inputProviders,
      environment: config.environment,
    });
  } catch (err) {
    await bootstrapResult.dispose();
    throw err;
  }

  // Auth setup — only enabled when jwtSecret is configured
  let authGate: AuthGate | undefined;
  let authMiddleware: AuthMiddleware | undefined;

  if (config.jwtSecret) {
    const jwtValidator = createJwtValidator({
      publicKeyOrSecret: config.jwtSecret,
    });

    authMiddleware = createAuthMiddleware({
      jwtValidator,
      adminRoles: config.adminRoles,
    });

    // Minimal WeaverConfig — only getRank is used by auth checks
    const layerRanks = new Map([
      ["platform", 0],
      ["tenant", 1],
      ["session", 2],
    ]);
    const weaverConfig = {
      layers: [],
      layerNames: [...layerRanks.keys()],
      rankMap: layerRanks,
      getRank: (layer: string) => layerRanks.get(layer) ?? -1,
      getLayer: () => undefined,
      getLayersByType: () => [],
    } satisfies WeaverConfig;

    const authFunctions = withAuth({
      weaverConfig,
      visibilityRoles: {
        admin: new Set(config.adminRoles),
        platform: new Set([...config.adminRoles, "platform"]),
      },
      layerWritePolicies: [
        { layer: "platform", allowedRoles: config.adminRoles },
      ],
      dynamicScopeRoles: new Set(config.adminRoles),
    });

    authGate = createAuthGate({
      authFunctions,
      mapContext: (authCtx) => ({
        userId:
          authCtx.identity.userId ?? authCtx.identity.serviceId ?? "anonymous",
        roles: authCtx.identity.roles ?? [],
        sessionMode: undefined,
      }),
    });
  }

  const restAdapterOptions: {
    configService: typeof configService;
    corsOrigins?: string[];
    authGate?: AuthGate;
  } = {
    configService,
  };
  if (config.corsOrigins) {
    restAdapterOptions.corsOrigins = config.corsOrigins;
  }
  if (authGate) {
    restAdapterOptions.authGate = authGate;
  }

  const restAdapter = createRestAdapter(restAdapterOptions);

  const sseAdapter = createSSEAdapter({ configService });
  sseAdapter.startCheckpointTimer();

  const handleRequest = createRequestHandler(
    health,
    restAdapter,
    sseAdapter,
    authMiddleware,
  );

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
    await bootstrapResult.dispose();
  });

  return {
    get port() {
      return server.port;
    },
    get isReady() {
      return health.readyz().status === 200;
    },
    get authEnabled() {
      return authMiddleware !== undefined;
    },
    async close() {
      await shutdownManager.shutdown();
    },
  };
}
