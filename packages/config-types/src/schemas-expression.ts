// schemas-expression.ts — Zod schemas for expression validation types

import { z } from "zod";

export const expressionValidationResultSchema = z.strictObject({
  valid: z.boolean(),
  errors: z.array(z.string()).readonly().optional(),
});
