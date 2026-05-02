// Git repository clone/pull management
import type { SimpleGit } from "simple-git";

export interface GitManagerOptions {
  repoUrl: string;
  localPath: string;
  branch?: string | undefined;
  token?: string | undefined;
  git?: SimpleGit | undefined;
}

export interface GitManager {
  ensureClone(): Promise<void>;
  pull(): Promise<void>;
  readonly localPath: string;
}

function injectToken(repoUrl: string, token: string): string {
  const url = new URL(repoUrl);
  url.username = token;
  return url.toString();
}

export function createGitManager(options: GitManagerOptions): GitManager {
  const { repoUrl, localPath, branch = "main", token, git } = options;

  if (!git) {
    throw new Error("SimpleGit instance is required");
  }

  const authUrl = token ? injectToken(repoUrl, token) : repoUrl;

  return {
    get localPath() {
      return localPath;
    },

    async ensureClone(): Promise<void> {
      const { existsSync } = await import("node:fs");
      const { join } = await import("node:path");

      if (existsSync(join(localPath, ".git"))) {
        await git.cwd(localPath);
        await git.pull(["--rebase"]);
      } else {
        await git.clone(authUrl, localPath, ["--branch", branch]);
        await git.cwd(localPath);
      }
    },

    async pull(): Promise<void> {
      await git.cwd(localPath);
      await git.pull(["--rebase"]);
    },
  };
}
