export interface StalenessConfig {
  /** Max age in ms before config is considered stale (default: 5 minutes) */
  maxAge?: number;
  /** Interval in ms to check staleness (default: 30 seconds) */
  checkInterval?: number;
}

export interface StalenessMonitor {
  readonly isStale: boolean;
  readonly staleSince: Date | null;
  onStalenessChange(callback: (isStale: boolean) => void): () => void;
  recordSync(): void;
  dispose(): void;
}

/**
 * Creates an interval-based freshness monitor.
 * Marks config as stale when time since last sync exceeds maxAge.
 */
export function createStalenessMonitor(
  config?: StalenessConfig,
): StalenessMonitor {
  const maxAge = config?.maxAge ?? 5 * 60 * 1000;
  const checkInterval = config?.checkInterval ?? 30 * 1000;

  let lastSyncAt = Date.now();
  let stale = false;
  let staleSinceDate: Date | null = null;
  const listeners = new Set<(isStale: boolean) => void>();

  function check(): void {
    const nowStale = Date.now() - lastSyncAt > maxAge;
    if (nowStale !== stale) {
      stale = nowStale;
      staleSinceDate = nowStale ? new Date(lastSyncAt + maxAge) : null;
      for (const cb of listeners) {
        cb(stale);
      }
    }
  }

  const timer = setInterval(check, checkInterval);

  return {
    get isStale(): boolean {
      return stale;
    },

    get staleSince(): Date | null {
      return staleSinceDate;
    },

    onStalenessChange(callback: (isStale: boolean) => void): () => void {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },

    recordSync(): void {
      lastSyncAt = Date.now();
      if (stale) {
        stale = false;
        staleSinceDate = null;
        for (const cb of listeners) {
          cb(false);
        }
      }
    },

    dispose(): void {
      clearInterval(timer);
      listeners.clear();
    },
  };
}
