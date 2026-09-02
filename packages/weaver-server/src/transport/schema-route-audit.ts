import type {
  SchemaDomainAuditEntry,
  SchemaRegistrationRequest,
  WriteResult,
} from "@weaver-conf/config-types";
import type { AuditService } from "../audit/audit-service";
import type { SchemaOperationContext } from "../core/schema-operation-context";
import {
  effectiveValidationOperation,
  registeredObjectWriteOperation,
  registeredPathPatchOperation,
  schemaRegistrationOperation,
  schemaSubjectFromIdentity,
} from "../core/schema-operation-context";
import type { SchemaRegistrationResult } from "../core/schema-registry";
import type { RestRequest } from "./rest-adapter";

export function schemaRegistrationRouteContext(
  req: RestRequest,
  body: SchemaRegistrationRequest,
): SchemaOperationContext {
  return schemaRegistrationOperation(body, subjectFromRequest(req));
}

export function schemaRegistrationRequestContext(
  req: RestRequest,
  operation: SchemaOperationContext,
) {
  const subject = subjectFromRequest(req);
  return {
    operation,
    ...(subject ? { subject, actor: subject } : {}),
  };
}

export function registeredObjectWriteRouteContext(
  req: RestRequest,
  path: string,
): SchemaOperationContext {
  return registeredObjectWriteOperation(
    path,
    req.query.env,
    subjectFromRequest(req),
  );
}

export function registeredPathPatchRouteContext(
  req: RestRequest,
  path: string,
): SchemaOperationContext {
  return registeredPathPatchOperation(
    path,
    req.query.env,
    subjectFromRequest(req),
  );
}

export function effectiveValidationRouteContext(
  req: RestRequest,
  path: string,
  environment?: string | undefined,
): SchemaOperationContext {
  return effectiveValidationOperation(
    path,
    environment,
    subjectFromRequest(req),
  );
}

export async function auditSchemaRegistration(
  auditService: AuditService | undefined,
  operation: SchemaOperationContext,
  result: SchemaRegistrationResult,
): Promise<void> {
  await recordSchemaAuditEvent(
    auditService,
    operation,
    result.success,
    result.error?.message,
  );
}

export async function auditSchemaWrite(
  auditService: AuditService | undefined,
  operation: SchemaOperationContext,
  result: WriteResult,
  fallback: string,
): Promise<void> {
  await recordSchemaAuditEvent(
    auditService,
    operation,
    result.success,
    result.error?.message ?? (result.success ? undefined : fallback),
  );
}

export async function recordSchemaAuditEvent(
  auditService: AuditService | undefined,
  context: SchemaOperationContext | undefined,
  success: boolean,
  error?: string | undefined,
): Promise<void> {
  if (!auditService || !context) return;
  await auditService.record(toSchemaAuditEntry(context, success, error));
}

function toSchemaAuditEntry(
  context: SchemaOperationContext,
  success: boolean,
  error?: string | undefined,
): SchemaDomainAuditEntry {
  return {
    domain: "schema",
    timestamp: new Date().toISOString(),
    actor: context.subject ?? "anonymous",
    action: context.operation,
    key: auditKey(context),
    environment: context.environment ?? "",
    success,
    metadata: context,
    ...(error ? { error } : {}),
  };
}

function auditKey(context: SchemaOperationContext): string {
  return (
    context.fragmentPath ??
    context.canonicalSlotPath ??
    context.servicePath ??
    context.writePath ??
    ""
  );
}

function subjectFromRequest(req: RestRequest): string | undefined {
  return schemaSubjectFromIdentity(req.authContext?.identity);
}
