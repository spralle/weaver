import type { SyncErrorMetadata } from "@weaver/config-types";

export interface RetryPolicyState {
  retryAttempt: number;
  retryScheduledAt?: number | undefined;
  lastError?: SyncErrorMetadata | undefined;
}

export interface RetryScheduleOptions {
  retryAttempt: number;
  retryBaseMs: number;
  retryMaxMs: number;
  now: () => number;
}

export function calculateRetryDelay(options: RetryScheduleOptions): number {
  const base = options.retryBaseMs * 2 ** (options.retryAttempt - 1);
  const jitter = Math.floor(
    Math.random() * Math.max(1, Math.floor(options.retryBaseMs / 4)),
  );
  return Math.min(options.retryMaxMs, base + jitter);
}

export function scheduleRetryState(
  currentAttempt: number,
  lastError: SyncErrorMetadata,
  options: Omit<RetryScheduleOptions, "retryAttempt">,
): RetryPolicyState {
  const retryAttempt = currentAttempt + 1;
  const delay = calculateRetryDelay({ ...options, retryAttempt });
  return {
    retryAttempt,
    retryScheduledAt: options.now() + delay,
    lastError,
  };
}
