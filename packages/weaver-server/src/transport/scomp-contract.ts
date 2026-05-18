// Scomp contract type definition for weaver config (ADR-0002 A.20)

import type {
  ConfigurationInspection,
  WriteResult,
} from "@weaver/config-types";
import type { ConfigDelta, ConfigSnapshot } from "../types/index.js";

export interface WeaverConfigContract {
  resolveAll: {
    request: { scope?: string };
    response: ConfigSnapshot;
  };
  get: {
    request: { key: string; scope?: string };
    response: { value: unknown };
  };
  getNamespace: {
    request: { prefix: string; scope?: string };
    response: { entries: Record<string, unknown> };
  };
  inspect: {
    request: { key: string };
    response: ConfigurationInspection<unknown>;
  };
  set: {
    request: {
      layer: string;
      key: string;
      value: unknown;
      environment?: string;
      scope?: string;
    };
    response: WriteResult;
  };
  remove: {
    request: {
      layer: string;
      key: string;
      environment?: string;
      scope?: string;
    };
    response: WriteResult;
  };
  promote: {
    request: {
      key: string;
      fromEnvironment: string;
      toEnvironment: string;
      layer: string;
    };
    response: { success: boolean };
  };
  rollback: {
    request: { layer: string; environment: string; toRevision: string };
    response: { success: boolean };
  };
  registerSchema: {
    request: { declaration: unknown; environment: string };
    response: { success: boolean };
  };
  configChanges: {
    request: Record<string, never>;
    item: ConfigDelta;
  };
}

export const WEAVER_CONFIG_V1 = "weaver-config-v1" as const;
