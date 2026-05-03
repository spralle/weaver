import { z } from "zod";

export const serverEnvSchema = z.object({
  WEAVER_PORT: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().int().min(1).max(65535).optional()),
  WEAVER_CONFIG_REPO: z.string().optional(),
  WEAVER_ENVIRONMENT: z.string().optional(),
  WEAVER_GIT_TOKEN: z.string().optional(),
  WEAVER_MONGO_URI: z.string().url("WEAVER_MONGO_URI must be a valid URL").optional(),
  WEAVER_JWT_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  env: Record<string, string | undefined> = process.env,
): ServerEnv {
  const result = serverEnvSchema.safeParse(env);
  if (!result.success) {
    const messages = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid server environment variables:\n${messages}\n\nCheck your environment configuration and try again.`,
    );
  }
  return result.data;
}
