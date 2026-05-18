// Health endpoints — liveness and readiness probes

export interface HealthStatus {
  status: "ok" | "degraded" | "unavailable" | "starting";
  uptime: number;
  revision?: string;
  providerCount?: number;
  degradedProviders?: ReadonlyArray<string>;
}

export interface DegradedProviderInfo {
  degradedProviders: ReadonlyArray<string>;
  totalProviders: number;
}

export interface HealthEndpoints {
  healthz(): { status: number; body: HealthStatus };
  readyz(): { status: number; body: HealthStatus };
  setReady(ready: boolean): void;
  setDegradedInfo(info: DegradedProviderInfo): void;
}

export function createHealthEndpoints(): HealthEndpoints {
  const startTime = Date.now();
  let ready = false;
  let degradedInfo: DegradedProviderInfo | null = null;

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

      const uptime = Date.now() - startTime;

      if (degradedInfo && degradedInfo.degradedProviders.length > 0) {
        const allFailed =
          degradedInfo.degradedProviders.length >= degradedInfo.totalProviders;

        if (allFailed) {
          return {
            status: 503,
            body: {
              status: "unavailable",
              uptime,
              degradedProviders: degradedInfo.degradedProviders,
            },
          };
        }

        return {
          status: 200,
          body: {
            status: "degraded",
            uptime,
            degradedProviders: degradedInfo.degradedProviders,
          },
        };
      }

      return {
        status: 200,
        body: { status: "ok", uptime },
      };
    },

    setReady(value: boolean): void {
      ready = value;
    },

    setDegradedInfo(info: DegradedProviderInfo): void {
      degradedInfo = info;
    },
  };
}
