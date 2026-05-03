/**
 * Structured log fields for correlation and context.
 */
export interface LogFields {
  correlationId?: string;
  context?: Record<string, unknown>;
}

/**
 * Minimal logger interface for storage providers.
 * Avoids depending on weaver-server (wrong dependency direction).
 *
 * Methods accept either structured fields or variadic args for backward compat.
 */
export interface WeaverLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

function isLogFields(value: unknown): value is LogFields {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const keys = Object.keys(value);
  return keys.every((k) => k === "correlationId" || k === "context");
}

function formatStructured(
  level: string,
  message: string,
  fields: LogFields,
): string {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  if (fields.correlationId) entry.correlationId = fields.correlationId;
  if (fields.context) entry.context = fields.context;
  return JSON.stringify(entry);
}

export const consoleLogger: WeaverLogger = {
  debug(message: string, ...args: unknown[]): void {
    if (args.length === 1 && isLogFields(args[0])) {
      console.debug(formatStructured("debug", message, args[0]));
    } else {
      console.debug(message, ...args);
    }
  },
  info(message: string, ...args: unknown[]): void {
    if (args.length === 1 && isLogFields(args[0])) {
      console.info(formatStructured("info", message, args[0]));
    } else {
      console.info(message, ...args);
    }
  },
  warn(message: string, ...args: unknown[]): void {
    if (args.length === 1 && isLogFields(args[0])) {
      console.warn(formatStructured("warn", message, args[0]));
    } else {
      console.warn(message, ...args);
    }
  },
  error(message: string, ...args: unknown[]): void {
    if (args.length === 1 && isLogFields(args[0])) {
      console.error(formatStructured("error", message, args[0]));
    } else {
      console.error(message, ...args);
    }
  },
};
