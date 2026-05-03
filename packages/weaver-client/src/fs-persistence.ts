import { existsSync, mkdirSync, renameSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { configSnapshotSchema } from "@weaver/config-types";
import type { ConfigSnapshot } from "./types.js";
import type { WeaverClientPersistence } from "./persistence.js";

export interface FileSystemPersistenceOptions {
  directory: string;
}

export function createFileSystemPersistence(options: FileSystemPersistenceOptions): WeaverClientPersistence {
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
