import type { WeaverError } from "./errors";
import type { ConfigurationPropertySchema } from "./property-schema";

/** Accountable owner contact metadata for schema registrations. */
export interface RegistrationOwner {
  readonly name: string;
  readonly contact: string;
}

/** Service-owned fragment slot declaration. */
export interface FragmentSlotDeclaration {
  readonly slotPath: string;
  readonly accepts: "object";
}

/** Path-first service schema registration request. */
export interface ServiceSchemaRegistrationRequest {
  readonly serviceId: string;
  readonly environment: string;
  readonly owner: RegistrationOwner;
  readonly schema: ConfigurationPropertySchema;
  readonly fragmentSlots: ReadonlyArray<FragmentSlotDeclaration>;
}

/** Path-first fragment schema registration request. */
export interface FragmentSchemaRegistrationRequest {
  readonly serviceId: string;
  readonly providerId: string;
  readonly slotPath: string;
  readonly environment: string;
  readonly owner: RegistrationOwner;
  readonly schema: ConfigurationPropertySchema;
}

export type SchemaRegistrationRequest =
  | ServiceSchemaRegistrationRequest
  | FragmentSchemaRegistrationRequest;

/** Canonical path metadata derived from a schema registration request. */
export interface SchemaRegistrationMetadata {
  readonly serviceId: string;
  readonly servicePath: string;
  readonly environment: string;
  readonly canonicalSlotPath?: string | undefined;
  readonly providerId?: string | undefined;
  readonly fragmentPath?: string | undefined;
}

/** Result returned by path-first schema registration endpoints. */
export interface SchemaRegistrationResponse {
  readonly success: boolean;
  readonly isNewSchema: boolean;
  readonly hasBreakingChanges: boolean;
  readonly metadata?: SchemaRegistrationMetadata | undefined;
  readonly breakingChanges?: ReadonlyArray<string> | undefined;
  readonly error?: WeaverError | undefined;
}
