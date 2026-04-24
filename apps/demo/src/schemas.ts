import { createSchemaRegistry } from "@weaver/config-engine";
import type { ConfigurationPropertySchema } from "@weaver/config-types";

export const schemaRegistry = createSchemaRegistry();

// Register UI namespace schemas
schemaRegistry.register({
  ownerId: "demo",
  namespace: "app.ui",
  properties: {
    theme: {
      type: "string",
      description: "UI theme preference",
      enum: ["light", "dark", "system"],
      changePolicy: "direct-allowed",
      visibility: "public",
    },
    language: {
      type: "string",
      description: "Interface language — locked at tenant",
      maxOverrideLayer: "tenant",
      changePolicy: "staging-gate",
      visibility: "public",
    },
    "sidebar.collapsed": {
      type: "boolean",
      description: "Sidebar collapsed state",
      changePolicy: "direct-allowed",
      visibility: "public",
    },
    "font.size": {
      type: "number",
      description: "Font size in pixels",
      minimum: 8,
      maximum: 32,
      changePolicy: "direct-allowed",
      visibility: "public",
    },
    "font.family": {
      type: "string",
      description: "Font family — platform locked",
      maxOverrideLayer: "app",
      changePolicy: "full-pipeline",
      visibility: "admin",
    },
  },
});

// Register feature namespace schemas
schemaRegistry.register({
  ownerId: "demo",
  namespace: "app.feature",
  properties: {
    "analytics.enabled": {
      type: "boolean",
      description: "Analytics toggle — requires staging",
      maxOverrideLayer: "tenant",
      changePolicy: "staging-gate",
      visibility: "admin",
    },
    "notifications.enabled": {
      type: "boolean",
      description: "Notification toggle",
      changePolicy: "direct-allowed",
      visibility: "public",
    },
    "notifications.frequency": {
      type: "string",
      description: "Notification frequency",
      enum: ["realtime", "hourly", "daily", "weekly"],
      changePolicy: "direct-allowed",
      visibility: "public",
    },
  },
});

// Register network namespace schemas
schemaRegistry.register({
  ownerId: "demo",
  namespace: "app.network",
  properties: {
    "timeout.ms": {
      type: "number",
      description: "Timeout — emergency only",
      minimum: 1000,
      maximum: 60000,
      maxOverrideLayer: "tenant",
      changePolicy: "emergency-override",
      visibility: "internal",
    },
    "retry.count": {
      type: "number",
      description: "Retry count — pipeline locked",
      minimum: 0,
      maximum: 10,
      maxOverrideLayer: "app",
      changePolicy: "full-pipeline",
      visibility: "internal",
    },
  },
});

export function getSchemaForKey(
  key: string,
): ConfigurationPropertySchema | undefined {
  return schemaRegistry.getSchema(key)?.schema;
}
