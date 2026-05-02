import type { ConfigSnapshot } from "./types.js";

export interface WeaverClientPersistence {
  save(serviceId: string, snapshot: ConfigSnapshot): Promise<void>;
  load(serviceId: string): Promise<ConfigSnapshot | null>;
}
