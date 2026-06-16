import { z } from "zod";
import type { Unsubscribe } from "@weaver-conf/config-types";

export type { Unsubscribe } from "@weaver-conf/config-types";

/** A configuration layer entry with priority-based resolution ordering. */
export interface LayerEntry {
  readonly id: string;
  readonly priority: number;
  readonly entries: Record<string, unknown>;
  readonly merge?: (
    base: Record<string, unknown>,
    override: Record<string, unknown>,
  ) => Record<string, unknown>;
}

/** Immutable snapshot of resolved configuration state. */
export interface StateSnapshot {
  readonly resolved: Record<string, unknown>;
  readonly provenance: Record<string, string>;
  readonly revision: number;
}

/** A delta describing changes to apply to the state container. */
export interface StateDelta {
  readonly set?: Record<string, unknown>;
  readonly removed?: string[];
  readonly revision: number;
}

/** Reactive state container that resolves config from prioritized layers. */
export interface StateContainer {
  resolve(): void;
  get(path: string): unknown;
  getAll(): Record<string, unknown>;
  subscribe(path: string, callback: (value: unknown) => void): Unsubscribe;
  subscribeAll(
    callback: (resolved: Record<string, unknown>) => void,
  ): Unsubscribe;
  applyDelta(delta: StateDelta): void;
  snapshot(): StateSnapshot;
  hydrate(snapshot: StateSnapshot): void;
  setLayer(layer: LayerEntry): void;
  removeLayer(id: string): void;
  getProvenance(path: string): string | undefined;
  readonly revision: number;
}

// Zod schemas for runtime validation at package boundary
export const LayerEntrySchema = z.object({
  id: z.string(),
  priority: z.number(),
  entries: z.record(z.string(), z.unknown()),
});

export const StateSnapshotSchema = z.object({
  resolved: z.record(z.string(), z.unknown()),
  provenance: z.record(z.string(), z.string()),
  revision: z.number(),
});

export const StateDeltaSchema = z.object({
  set: z.record(z.string(), z.unknown()).optional(),
  removed: z.array(z.string()).optional(),
  revision: z.number(),
});
