import type { Unsubscribe } from "./types";

type PathCallback = (value: unknown) => void;
type AllCallback = (resolved: Record<string, unknown>) => void;

export interface SubscriptionManager {
  subscribePath(path: string, callback: PathCallback): Unsubscribe;
  subscribeAll(callback: AllCallback): Unsubscribe;
  notify(
    changedPaths: Set<string>,
    getValue: (path: string) => unknown,
    resolved: Record<string, unknown>,
  ): void;
}

export function createSubscriptionManager(): SubscriptionManager {
  const pathSubs = new Map<string, Set<PathCallback>>();
  const allSubs = new Set<AllCallback>();

  function subscribePath(path: string, callback: PathCallback): Unsubscribe {
    let set = pathSubs.get(path);
    if (!set) {
      set = new Set();
      pathSubs.set(path, set);
    }
    set.add(callback);
    return () => {
      set.delete(callback);
      if (set.size === 0) pathSubs.delete(path);
    };
  }

  function subscribeAll(callback: AllCallback): Unsubscribe {
    allSubs.add(callback);
    return () => {
      allSubs.delete(callback);
    };
  }

  function notify(
    changedPaths: Set<string>,
    getValue: (path: string) => unknown,
    resolved: Record<string, unknown>,
  ): void {
    // Fire path-specific subscriptions (prefix matching)
    for (const [subPath, callbacks] of pathSubs) {
      const shouldFire = pathMatchesAnyChange(subPath, changedPaths);
      if (shouldFire) {
        const value = getValue(subPath);
        for (const cb of callbacks) cb(value);
      }
    }
    // Fire all-subscribers
    for (const cb of allSubs) cb(resolved);
  }

  return { subscribePath, subscribeAll, notify };
}

/** A subscription path fires if any changed path is equal to or nested under it */
function pathMatchesAnyChange(
  subPath: string,
  changedPaths: Set<string>,
): boolean {
  for (const changed of changedPaths) {
    if (
      changed === subPath ||
      changed.startsWith(`${subPath}.`) ||
      subPath.startsWith(`${changed}.`)
    ) {
      return true;
    }
  }
  return false;
}
