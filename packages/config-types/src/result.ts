/**
 * Discriminated union for fallible operations.
 * Prefer this over throwing at library boundaries.
 */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Creates a successful Result containing the given value. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Creates a failed Result containing the given error. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Type guard — narrows a Result to its success variant. */
export function isOk<T, E>(
  result: Result<T, E>,
): result is { ok: true; value: T } {
  return result.ok;
}

/** Type guard — narrows a Result to its error variant. */
export function isErr<T, E>(
  result: Result<T, E>,
): result is { ok: false; error: E } {
  return !result.ok;
}
