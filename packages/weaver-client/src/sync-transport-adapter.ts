import type {
  ConfigSyncAckRequest,
  ConfigSyncAckResponse,
  ConfigSyncPullRequest,
  ConfigSyncPullResponse,
  ConfigSyncPushRequest,
  ConfigSyncPushResponse,
  ConfigSyncPushResult,
  ConfigSyncTransport,
  SyncCursor,
  SyncRemoteChange,
} from "@weaver-conf/config-types";
import type { WeaverTransport, WriteResult } from "./transport";

export function createWeaverSyncTransport(
  transport: WeaverTransport,
): ConfigSyncTransport {
  let lastKnownEntries: Record<string, unknown> = {};

  return {
    async pull(
      request: ConfigSyncPullRequest,
    ): Promise<ConfigSyncPullResponse> {
      const snapshot = await transport.resolveAll();
      const now = Date.now();
      const cursor: SyncCursor = {
        serverRevision: snapshot.revision,
        serverTime: now,
      };

      const changes: SyncRemoteChange[] = [];

      for (const [key, value] of Object.entries(snapshot.entries)) {
        const oldValue = lastKnownEntries[key];
        if (oldValue === undefined || oldValue !== value) {
          changes.push({
            key,
            value,
            operation: "set",
            revision: snapshot.revision,
            serverTime: now,
          });
        }
      }

      for (const key of Object.keys(lastKnownEntries)) {
        if (!(key in snapshot.entries)) {
          changes.push({
            key,
            operation: "remove",
            revision: snapshot.revision,
            serverTime: now,
          });
        }
      }

      lastKnownEntries = { ...snapshot.entries };

      const limited = request.limit ? changes.slice(0, request.limit) : changes;

      return { cursor, serverTime: now, changes: limited };
    },

    async push(
      request: ConfigSyncPushRequest,
    ): Promise<ConfigSyncPushResponse> {
      const results: ConfigSyncPushResult[] = [];
      let latestRevision = "";

      for (const mutation of request.mutations) {
        const writeResult: WriteResult =
          mutation.operation === "set"
            ? await transport.set(mutation.key, mutation.value)
            : await transport.remove(mutation.key);

        if (writeResult.revision) {
          latestRevision = writeResult.revision;
        }

        results.push(
          buildPushResult(mutation.mutationId, mutation, writeResult),
        );
      }

      return {
        requestId: request.requestId,
        serverRevision: latestRevision,
        serverTime: Date.now(),
        results,
      };
    },

    async ack(request: ConfigSyncAckRequest): Promise<ConfigSyncAckResponse> {
      return {
        requestId: request.requestId,
        acked: true,
        serverRevision: "",
        serverTime: Date.now(),
      };
    },
  };
}

interface MutationInfo {
  key: string;
  baseRevision?: string | undefined;
  value?: unknown;
}

function buildPushResult(
  mutationId: string,
  mutation: MutationInfo,
  writeResult: WriteResult,
): ConfigSyncPushResult {
  const result: ConfigSyncPushResult = {
    mutationId,
    accepted: writeResult.success,
    revision: writeResult.revision,
  };

  if (!writeResult.success && writeResult.error) {
    const isConflict = writeResult.error.code === "REVISION_CONFLICT";
    result.error = {
      code: isConflict ? "conflict" : "server",
      message: writeResult.error.message,
      retryable: isConflict,
    };

    if (isConflict) {
      result.conflict = {
        key: mutation.key,
        mutationId,
        localRevision: mutation.baseRevision,
        serverRevision: writeResult.revision ?? "",
        localValue: mutation.value,
        serverTime: Date.now(),
      };
    }
  }

  return result;
}
