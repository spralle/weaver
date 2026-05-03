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
  refresh(): Promise<void>;
  commitAndPush(message: string, files: string[]): Promise<void>;
  revert(toRevision: string, actor: string): Promise<{ revertedCommits: number }>;
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

  let mutexChain: Promise<void> = Promise.resolve();

  function serialize<T>(fn: () => Promise<T>): Promise<T> {
    const result = mutexChain.then(fn, fn);
    mutexChain = result.then(
      () => {},
      () => {},
    );
    return result;
  }

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

    async refresh(): Promise<void> {
      return serialize(async () => {
        await git.cwd(localPath);
        await git.pull(["--rebase"]);
      });
    },

    async commitAndPush(message: string, files: string[]): Promise<void> {
      if (files.length === 0) return;
      return serialize(async () => {
        await git.cwd(localPath);
        for (const file of files) {
          await git.add(file);
        }
        await git.commit(message);
        await git.pull(["--rebase"]);
        await git.push();
      });
    },

    async revert(toRevision: string, actor: string): Promise<{ revertedCommits: number }> {
      return serialize(async () => {
        await git.cwd(localPath);
        const log = await git.log({ from: toRevision, to: "HEAD" });
        const commitCount = log.total;
        if (commitCount === 0) {
          return { revertedCommits: 0 };
        }
        await git.raw(["revert", "--no-commit", `${toRevision}..HEAD`]);
        await git.commit(`rollback: revert to ${toRevision} by ${actor}`);
        await git.push();
        return { revertedCommits: commitCount };
      });
    },
  };
}
