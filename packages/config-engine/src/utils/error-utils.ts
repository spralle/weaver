/**
 * Extract a human-readable message from an unknown caught value.
 */
export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Type guard for Node.js system errors (ENOENT, EACCES, etc.).
 */
export function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
