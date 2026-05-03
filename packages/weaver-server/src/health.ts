// Health endpoints — liveness and readiness probes

export interface HealthStatus {
  status: "ok" | "degraded" | "starting";
  uptime: number;
  revision?: string;
  providerCount?: number;
}

export interface HealthEndpoints {
  healthz(): { status: number; body: HealthStatus };
  readyz(): { status: number; body: HealthStatus };
  setReady(ready: boolean): void;
}

export function createHealthEndpoints(): HealthEndpoints {
  const startTime = Date.now();
  let ready = false;

  return {
    healthz() {
      return {
        status: 200,
        body: { status: "ok", uptime: Date.now() - startTime },
      };
    },

    readyz() {
      if (!ready) {
        return {
          status: 503,
          body: { status: "starting", uptime: Date.now() - startTime },
        };
      }
      return {
        status: 200,
        body: { status: "ok", uptime: Date.now() - startTime },
      };
    },

    setReady(value: boolean): void {
      ready = value;
    },
  };
}
