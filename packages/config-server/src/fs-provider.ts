import { readFile, writeFile, rename, stat, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type {
  ConfigurationStorageProvider,
  ConfigurationLayerData,
  WriteResult,
} from "@weaver/config-types";
import type { ConfigurationLayer } from "@weaver/config-types";
import { deepMerge } from "@weaver/config-engine";

export interface FileSystemProviderOptions {
  id: string;
  layer: ConfigurationLayer | string;
  filePath: string;
  writable?: boolean | undefined;
  environmentOverlayPath?: string | undefined;
}

export class FileSystemStorageProvider implements ConfigurationStorageProvider {
  readonly id: string;
  readonly layer: ConfigurationLayer | string;
  readonly writable: boolean;

  private readonly filePath: string;
  private readonly envOverlayPath: string | undefined;

  constructor(options: FileSystemProviderOptions) {
    this.id = options.id;
    this.layer = options.layer;
    this.writable = options.writable ?? false;
    this.filePath = resolve(options.filePath);
    this.envOverlayPath = options.environmentOverlayPath
      ? resolve(options.environmentOverlayPath)
      : undefined;
  }

  async load(): Promise<ConfigurationLayerData> {
    let entries = await this.readJsonFile(this.filePath);
    const revision = await this.getRevision(this.filePath);

    if (this.envOverlayPath) {
      const overlay = await this.readJsonFile(this.envOverlayPath);
      entries = deepMerge(entries, overlay);
    }

    const result: ConfigurationLayerData = { entries };
    if (revision !== undefined) {
      result.revision = revision;
    }
    return result;
  }

  async write(key: string, value: unknown): Promise<WriteResult> {
    if (!this.writable) {
      return { success: false, error: "Provider is read-only" };
    }

    const entries = await this.readJsonFile(this.filePath);
    entries[key] = value;
    await this.atomicWrite(this.filePath, entries);

    const revision = await this.getRevision(this.filePath);
    return { success: true, revision };
  }

  async remove(key: string): Promise<WriteResult> {
    if (!this.writable) {
      return { success: false, error: "Provider is read-only" };
    }

    const entries = await this.readJsonFile(this.filePath);
    delete entries[key];
    await this.atomicWrite(this.filePath, entries);

    const revision = await this.getRevision(this.filePath);
    return { success: true, revision };
  }

  private async readJsonFile(path: string): Promise<Record<string, unknown>> {
    try {
      const content = await readFile(path, "utf-8");
      return JSON.parse(content) as Record<string, unknown>;
    } catch (err: unknown) {
      if (err instanceof SyntaxError) {
        console.warn(`Invalid JSON in config file: ${path}`);
        return {};
      }
      if (isNodeError(err) && err.code === "ENOENT") {
        return {};
      }
      throw err;
    }
  }

  private async getRevision(path: string): Promise<string | undefined> {
    try {
      const stats = await stat(path);
      return stats.mtime.toISOString();
    } catch {
      return undefined;
    }
  }

  private async atomicWrite(
    path: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const dir = dirname(path);
    await mkdir(dir, { recursive: true });
    const tmpPath = `${path}.tmp`;
    await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    await rename(tmpPath, path);
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
