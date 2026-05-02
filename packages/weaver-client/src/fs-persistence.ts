import { existsSync, mkdirSync, renameSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ConfigSnapshot } from "./types.js";
import type { WeaverClientPersistence } from "./persistence.js";

export interface FileSystemPersistenceOptions {
  directory: string;
}

export function createFileSystemPersistence(options: FileSystemPersistenceOptions): WeaverClientPersistence {
  const { directory } = options;

  return {
    async save(serviceId: string, snapshot: ConfigSnapshot): Promise<void> {
      mkdirSync(directory, { recursive: true });
      const filePath = join(directory, `${serviceId}.json`);
      const tempPath = `${filePath}.tmp`;
      writeFileSync(tempPath, JSON.stringify(snapshot), "utf-8");
      renameSync(tempPath, filePath);
    },

    async load(serviceId: string): Promise<ConfigSnapshot | null> {
      const filePath = join(directory, `${serviceId}.json`);
      if (!existsSync(filePath)) return null;
      const content = readFileSync(filePath, "utf-8");
      return JSON.parse(content) as ConfigSnapshot;
    },
  };
}
