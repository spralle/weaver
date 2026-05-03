// schemas-bootstrap.ts — Zod schemas for bootstrap configuration
import { z } from "zod";

/** Built-in provider types. The registry also accepts custom strings. */
export const builtinProviders = ["git", "mongodb", "memory"] as const;
export const layerProviderSchema = z.string().min(1);

export const bootstrapLayerSchema = z.object({
  id: z.string(),
  provider: layerProviderSchema,
  path: z.string().optional(),
  collection: z.string().optional(),
});

export const bootstrapConfigSchema = z
  .object({
    layers: z.array(bootstrapLayerSchema),
    mongodb: z
      .object({
        uri: z.string(),
      })
      .optional(),
  })
  .check(
    z.refine((data) => {
      const needsMongo = data.layers.some((l) => l.provider === "mongodb");
      return !needsMongo || data.mongodb !== undefined;
    }, { message: "mongodb config is required when any layer uses 'mongodb' provider" }),
  );

export type BootstrapConfig = z.infer<typeof bootstrapConfigSchema>;
export type BootstrapLayer = z.infer<typeof bootstrapLayerSchema>;
export type LayerProvider = z.infer<typeof layerProviderSchema>;
