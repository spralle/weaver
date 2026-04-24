// Emergency override tracker interface for lifecycle tracking

import type { EmergencyOverrideRecord } from "@weaver/config-types";

export interface OverrideTrackerOptions {
  /**
   * Deadline duration in milliseconds from override creation.
   * Defaults to 24 hours (86_400_000 ms).
   */
  readonly followUpDeadlineMs?: number | undefined;
}

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

const DEFAULT_FOLLOW_UP_DEADLINE_MS = 24 * 60 * 60 * 1000;

export function computeDeadline(
  createdAt: string,
  deadlineMs: number = DEFAULT_FOLLOW_UP_DEADLINE_MS,
): string {
  return new Date(new Date(createdAt).getTime() + deadlineMs).toISOString();
}

export function resolveDeadlineMs(
  options?: OverrideTrackerOptions | undefined,
): number {
  return options?.followUpDeadlineMs ?? DEFAULT_FOLLOW_UP_DEADLINE_MS;
}
