export interface ExpressionValidationResult {
  valid: boolean;
  errors?: ReadonlyArray<string> | undefined;
}

export interface ExpressionEvaluatorProvider {
  readonly formatId: string;
  isExpression(value: unknown): boolean;
  evaluate<T>(expression: unknown, context: Record<string, unknown>): T;
  validate(expression: unknown): ExpressionValidationResult;
}
