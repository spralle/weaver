// Scomp contract type definition for weaver config (ADR-0002 A.20)
import type { ConfigSnapshot, ConfigDelta } from "../types/index.js";
import type { ConfigurationInspection } from "@weaver/config-types";
import type { WriteResult } from "@weaver/config-types";

export interface WeaverConfigContract {
  resolveAll: {
    request: { serviceId: string; tenantId?: string };
    response: ConfigSnapshot;
  };
  get: {
    request: { serviceId: string; key: string; tenantId?: string };
    response: { value: unknown };
  };
  getNamespace: {
    request: { serviceId: string; prefix: string; tenantId?: string };
    response: { entries: Record<string, unknown> };
  };
  inspect: {
    request: { serviceId: string; key: string };
    response: ConfigurationInspection<unknown>;
  };
  set: {
    request: {
      layer: string;
      key: string;
      value: unknown;
      environment?: string;
      tenantId?: string;
    };
    response: WriteResult;
  };
  remove: {
    request: {
      layer: string;
      key: string;
      environment?: string;
      tenantId?: string;
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
    request: { serviceId: string };
    item: ConfigDelta;
  };
}

export const WEAVER_CONFIG_V1 = "weaver-config-v1" as const;
