import { z } from 'zod';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
}

/**
 * Safely parses the object using Zod schema.safeParse() and returns formatted validation errors.
 */
export function validateWithSchema<T>(schema: z.ZodType<T>, data: any): ValidationResult<T> {
  if (!schema) {
    return { success: true, data: data as T, errors: [] };
  }

  const parseResult = schema.safeParse(data);

  if (parseResult.success) {
    return {
      success: true,
      data: parseResult.data,
      errors: [],
    };
  }

  const errors = parseResult.error.issues.map(issue => {
    const path = issue.path.join('.');
    return path ? `Field '${path}': ${issue.message}` : issue.message;
  });

  return {
    success: false,
    errors,
  };
}
