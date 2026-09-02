import {
  assertPublicConfigPath,
  deriveFragmentPath,
  deriveServicePath,
} from "@weaver-conf/config-engine";
import type {
  FragmentSchemaRegistrationRequest,
  SchemaRegistrationRequest,
  ServiceSchemaRegistrationRequest,
} from "@weaver-conf/config-types";

export type SchemaOperationKind =
  | "schema.register.service"
  | "schema.register.fragment"
  | "schema.write.object"
  | "schema.patch.path"
  | "schema.validate.effective";

export interface SchemaOperationContext {
  readonly operation: SchemaOperationKind;
  readonly subject?: string | undefined;
  readonly serviceId?: string | undefined;
  readonly providerId?: string | undefined;
  readonly servicePath?: string | undefined;
  readonly canonicalSlotPath?: string | undefined;
  readonly fragmentPath?: string | undefined;
  readonly writePath?: string | undefined;
  readonly environment?: string | undefined;
}

export interface SchemaPolicyHook {
  inspect(context: SchemaOperationContext): void | Promise<void>;
}

export function schemaSubjectFromIdentity(
  identity:
    | { readonly serviceId?: string | undefined; readonly userId?: string }
    | undefined,
): string | undefined {
  return identity?.serviceId ?? identity?.userId;
}

export function schemaRegistrationOperation(
  request: SchemaRegistrationRequest,
  subject?: string | undefined,
): SchemaOperationContext {
  return "providerId" in request
    ? fragmentRegistrationOperation(request, subject)
    : serviceRegistrationOperation(request, subject);
}

export function serviceRegistrationOperation(
  request: ServiceSchemaRegistrationRequest,
  subject?: string | undefined,
): SchemaOperationContext {
  const derived = safeServicePath(request.serviceId);
  return {
    operation: "schema.register.service",
    serviceId: request.serviceId,
    providerId: request.serviceId,
    servicePath: derived.servicePath,
    environment: request.environment,
    ...(subject ? { subject } : {}),
  };
}

export function fragmentRegistrationOperation(
  request: FragmentSchemaRegistrationRequest,
  subject?: string | undefined,
): SchemaOperationContext {
  const derived = safeFragmentPath(request);
  return {
    operation: "schema.register.fragment",
    serviceId: request.serviceId,
    providerId: request.providerId,
    servicePath: derived.servicePath,
    canonicalSlotPath: derived.canonicalSlotPath,
    fragmentPath: derived.fragmentPath,
    environment: request.environment,
    ...(subject ? { subject } : {}),
  };
}

export function registeredObjectWriteOperation(
  path: string,
  environment?: string | undefined,
  subject?: string | undefined,
): SchemaOperationContext {
  return writeOperation("schema.write.object", path, environment, subject);
}

export function registeredPathPatchOperation(
  path: string,
  environment?: string | undefined,
  subject?: string | undefined,
): SchemaOperationContext {
  return writeOperation("schema.patch.path", path, environment, subject);
}

export function effectiveValidationOperation(
  path: string,
  environment?: string | undefined,
  subject?: string | undefined,
): SchemaOperationContext {
  return writeOperation(
    "schema.validate.effective",
    path,
    environment,
    subject,
  );
}

function writeOperation(
  operation: SchemaOperationKind,
  path: string,
  environment?: string | undefined,
  subject?: string | undefined,
): SchemaOperationContext {
  const writePath = safeCanonicalPath(path);
  return {
    operation,
    writePath,
    serviceId: serviceIdFromPath(writePath),
    environment,
    ...(subject ? { subject } : {}),
  };
}

function safeServicePath(serviceId: string): { readonly servicePath: string } {
  try {
    return deriveServicePath(serviceId);
  } catch {
    return { servicePath: `/${serviceId}` };
  }
}

function safeFragmentPath(request: FragmentSchemaRegistrationRequest): {
  readonly servicePath: string;
  readonly canonicalSlotPath: string;
  readonly fragmentPath: string;
} {
  try {
    return deriveFragmentPath(
      request.serviceId,
      request.slotPath,
      request.providerId,
    );
  } catch {
    const { servicePath } = safeServicePath(request.serviceId);
    const slot = request.slotPath.startsWith("/")
      ? request.slotPath
      : `/${request.slotPath}`;
    const canonicalSlotPath = `${servicePath}${slot}`;
    return {
      servicePath,
      canonicalSlotPath,
      fragmentPath: `${canonicalSlotPath}/${request.providerId}`,
    };
  }
}

function safeCanonicalPath(path: string): string {
  try {
    return assertPublicConfigPath(path);
  } catch {
    return path;
  }
}

function serviceIdFromPath(path: string): string | undefined {
  if (!path.startsWith("/")) return undefined;
  const [serviceId] = path.slice(1).split("/");
  return serviceId || undefined;
}
