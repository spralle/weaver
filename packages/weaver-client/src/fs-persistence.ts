import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { configSnapshotSchema } from "@weaver-conf/config-types";
import type { WeaverClientPersistence } from "./persistence.js";
import type { ConfigSnapshot } from "./types.js";

/** Options for file-system based snapshot persistence. */
export interface FileSystemPersistenceOptions {
  directory: string;
}

/**
 * Creates a file-system persistence adapter that stores snapshots as JSON files.
 * Uses atomic write (temp + rename) to prevent corruption.
 *
 * @param options - Directory path for snapshot storage
 */
export function createFileSystemPersistence(
  options: FileSystemPersistenceOptions,
): WeaverClientPersistence {
  const { directory } = options;

  return {
    async save(namespace: string, snapshot: ConfigSnapshot): Promise<void> {
      mkdirSync(directory, { recursive: true });
      const filePath = join(directory, `${namespace}.json`);
      const tempPath = `${filePath}.tmp`;
      writeFileSync(tempPath, JSON.stringify(snapshot), "utf-8");
      renameSync(tempPath, filePath);
    },

    async load(namespace: string): Promise<ConfigSnapshot | null> {
      const filePath = join(directory, `${namespace}.json`);
      if (!existsSync(filePath)) return null;
      const content = readFileSync(filePath, "utf-8");
      return configSnapshotSchema.parse(JSON.parse(content));
    },
  };
}
