// Git repository clone/pull management

import {
  consoleLogger,
  extractErrorMessage,
  type WeaverLogger,
} from "@weaver/config-engine";
import type { SimpleGit } from "simple-git";

/** Result of a git operation — success with data or failure with error details. */
export type GitOperationResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; retryable: boolean };

/** Options for creating a git manager (repo URL, local path, branch, auth). */
export interface GitManagerOptions {
  repoUrl: string;
  localPath: string;
  branch?: string | undefined;
  token?: string | undefined;
  git?: SimpleGit | undefined;
}

/** Manages a local git clone — handles clone, pull, commit+push, and revert operations. */
export interface GitManager {
  ensureClone(): Promise<GitOperationResult>;
  refresh(): Promise<GitOperationResult>;
  commitAndPush(message: string, files: string[]): Promise<GitOperationResult>;
  revert(
    toRevision: string,
    actor: string,
  ): Promise<GitOperationResult<{ revertedCommits: number }>>;
  readonly localPath: string;
}

function injectToken(repoUrl: string, token: string): string {
  const url = new URL(repoUrl);
  url.username = token;
  return url.toString();
}

function isTransientError(err: unknown): boolean {
  const message = extractErrorMessage(err);
  return /timeout|ECONNREFUSED|ENOTFOUND|network|fetch/.test(message);
}

function toFailure(err: unknown): {
  success: false;
  error: string;
  retryable: boolean;
} {
  const message = extractErrorMessage(err);
  consoleLogger.error(`[weaver] Git operation failed: ${message}`);
  return { success: false, error: message, retryable: isTransientError(err) };
}

export function createGitManager(options: GitManagerOptions): GitManager {
  const { repoUrl, localPath, branch = "main", token, git } = options;

  if (!git) {
    throw new Error("SimpleGit instance is required");
  }

  const authUrl = token ? injectToken(repoUrl, token) : repoUrl;

  let mutexChain: Promise<void> = Promise.resolve();

  function serialize<T>(fn: () => Promise<T>): Promise<T> {
    const result = mutexChain.then(fn);
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

    async ensureClone(): Promise<GitOperationResult> {
      try {
        const { existsSync } = await import("node:fs");
        const { join } = await import("node:path");

        if (existsSync(join(localPath, ".git"))) {
          await git.cwd(localPath);
          await git.pull(["--rebase"]);
        } else {
          await git.clone(authUrl, localPath, ["--branch", branch]);
          await git.cwd(localPath);
        }
        return { success: true, data: undefined };
      } catch (err) {
        return toFailure(err);
      }
    },

    async refresh(): Promise<GitOperationResult> {
      try {
        return await serialize(async () => {
          await git.cwd(localPath);
          await git.pull(["--rebase"]);
          return { success: true as const, data: undefined };
        });
      } catch (err) {
        return toFailure(err);
      }
    },

    async commitAndPush(
      message: string,
      files: string[],
    ): Promise<GitOperationResult> {
      if (files.length === 0) return { success: true, data: undefined };
      try {
        return await serialize(async () => {
          await git.cwd(localPath);
          for (const file of files) {
            await git.add(file);
          }
          await git.commit(message);
          await git.pull(["--rebase"]);
          await git.push();
          return { success: true as const, data: undefined };
        });
      } catch (err) {
        return toFailure(err);
      }
    },

    async revert(
      toRevision: string,
      actor: string,
    ): Promise<GitOperationResult<{ revertedCommits: number }>> {
      try {
        return await serialize(async () => {
          await git.cwd(localPath);
          const log = await git.log({ from: toRevision, to: "HEAD" });
          const commitCount = log.total;
          if (commitCount === 0) {
            return { success: true as const, data: { revertedCommits: 0 } };
          }
          await git.raw(["revert", "--no-commit", `${toRevision}..HEAD`]);
          await git.commit(`rollback: revert to ${toRevision} by ${actor}`);
          await git.push();
          return {
            success: true as const,
            data: { revertedCommits: commitCount },
          };
        });
      } catch (err) {
        return toFailure(err);
      }
    },
  };
}
