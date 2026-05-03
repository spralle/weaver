// Weaver server entry point — orchestrates all subsystems
import { createHealthEndpoints } from "./health.js";
import { createShutdownManager } from "./shutdown.js";
import { createAuditService } from "./audit/audit-service.js";
import { createStdoutAuditSink } from "./audit/stdout-sink.js";
import type { HealthEndpoints } from "./health.js";

declare const Bun: {
  serve(options: { port: number; fetch: (req: Request) => Response }): {
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
}

export interface WeaverServer {
  readonly port: number;
  readonly isReady: boolean;
  close(): Promise<void>;
}

function resolveOptions(options?: WeaverServerOptions) {
  return {
    port: options?.port ?? (Number(process.env["WEAVER_PORT"]) || 3399),
    repoUrl: options?.repoUrl ?? process.env["WEAVER_CONFIG_REPO"] ?? "",
    environment: options?.environment ?? process.env["WEAVER_ENVIRONMENT"] ?? "development",
    gitToken: options?.gitToken ?? process.env["WEAVER_GIT_TOKEN"],
    mongoUri: options?.mongoUri ?? process.env["WEAVER_MONGO_URI"],
    jwtSecret: options?.jwtSecret ?? process.env["WEAVER_JWT_SECRET"],
    adminRoles: options?.adminRoles ?? ["admin"],
  };
}

function createRequestHandler(health: HealthEndpoints) {
  return function handleRequest(req: Request): Response {
    const url = new URL(req.url);

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

    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  };
}

export async function startWeaverServer(options?: WeaverServerOptions): Promise<WeaverServer> {
  const config = resolveOptions(options);

  const health = createHealthEndpoints();
  const shutdownManager = createShutdownManager({ drainTimeoutMs: 10_000 });

  const auditService = createAuditService({
    sinks: [createStdoutAuditSink()],
  });

  const handleRequest = createRequestHandler(health);

  const server = Bun.serve({
    port: config.port,
    fetch: handleRequest,
  });

  health.setReady(true);

  shutdownManager.onShutdown(async () => {
    health.setReady(false);
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
