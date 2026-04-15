// Emergency override tracker interface for lifecycle tracking

import type { EmergencyOverrideRecord } from "@weaver/config-types";

export interface OverrideTracker {
  create(
    record: Omit<EmergencyOverrideRecord, "followUpDeadline">,
  ): Promise<EmergencyOverrideRecord>;
  listActive(): Promise<EmergencyOverrideRecord[]>;
  regularize(
    id: string,
    regularizedBy: string,
  ): Promise<EmergencyOverrideRecord | undefined>;
  listOverdue(now?: string | undefined): Promise<EmergencyOverrideRecord[]>;
}
