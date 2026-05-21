/** Result of validating an expression string before evaluation. */
export interface ExpressionValidationResult {
  valid: boolean;
  errors?: ReadonlyArray<string> | undefined;
}

/** Pluggable expression evaluator for dynamic config values (e.g., template strings). */
export interface ExpressionEvaluatorProvider {
  readonly formatId: string;
  isExpression(value: unknown): boolean;
  evaluate<T>(expression: unknown, context: Record<string, unknown>): T;
  validate(expression: unknown): ExpressionValidationResult;
}
