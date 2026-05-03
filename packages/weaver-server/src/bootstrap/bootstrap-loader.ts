// Bootstrap loader — reads config from Git, resolves env vars, creates providers
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ConfigurationStorageProvider } from "@weaver/config-types";
import type { GitManager } from "@weaver/storage-provider-git";
import { createGitManager } from "@weaver/storage-provider-git";
import type { Collection } from "mongodb";
import type { SimpleGit } from "simple-git";
import { bootstrapConfigSchema } from "../types/bootstrap.js";
import { resolveEnvVars } from "./env-resolver.js";
import { createProviders } from "./layer-factory.js";

export interface BootstrapResult {
  providers: ConfigurationStorageProvider[];
  gitManager: GitManager;
  environment: string;
}

export interface BootstrapOptions {
  repoUrl: string;
  branch?: string | undefined;
  gitToken?: string | undefined;
  environment: string;
  mongoUri?: string | undefined;
  mongoCollection?: Collection | undefined;
  git: SimpleGit;
}

export async function bootstrap(
  options: BootstrapOptions,
): Promise<BootstrapResult> {
  const { repoUrl, branch, gitToken, environment, git } = options;

  const localPath = join(process.cwd(), ".weaver-config", environment);

  const gitManager = createGitManager({
    repoUrl,
    localPath,
    branch,
    token: gitToken,
    git,
  });

  await gitManager.ensureClone();

  const configPath = join(gitManager.localPath, "bootstrap", "server.json");
  const rawContent = await readFile(configPath, "utf-8");
  const rawConfig = JSON.parse(rawContent) as unknown;

  const env: Record<string, string | undefined> = {
    ...process.env,
    WEAVER_MONGO_URI: options.mongoUri,
    WEAVER_ENVIRONMENT: environment,
  };
  const resolvedConfig = resolveEnvVars(rawConfig, env);

  const parsed = bootstrapConfigSchema.parse(resolvedConfig);

  const providers = createProviders(parsed, {
    gitManager,
    mongoCollection: options.mongoCollection,
    environment,
  });

  return { providers, gitManager, environment };
}
