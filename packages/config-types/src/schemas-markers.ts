import { z } from "zod";

export const secretReferenceSchema = z.strictObject({
  _weaver: z.literal("secret-ref"),
  provider: z.string(),
  uri: z.string(),
  version: z.string().optional(),
});

export const configMountSchema = z.strictObject({
  _weaver: z.literal("mount"),
  source: z.string(),
});

export const weaverMarkerSchema = z.discriminatedUnion("_weaver", [
  secretReferenceSchema,
  configMountSchema,
]);
