export interface SecretReference {
  readonly _weaver: "secret-ref";
  readonly provider: string;
  readonly uri: string;
  readonly version?: string | undefined;
}

export interface ConfigMount {
  readonly _weaver: "mount";
  readonly source: string;
}

export type WeaverMarker = SecretReference | ConfigMount;

export function isWeaverMarker(value: unknown): value is WeaverMarker {
  return (
    typeof value === "object" &&
    value !== null &&
    "_weaver" in value &&
    typeof (value as Record<string, unknown>)._weaver === "string" // SAFETY: duck-typing check for marker interface
  );
}

export function isSecretReference(value: unknown): value is SecretReference {
  return isWeaverMarker(value) && value._weaver === "secret-ref";
}

export function isConfigMount(value: unknown): value is ConfigMount {
  return isWeaverMarker(value) && value._weaver === "mount";
}
