/**
 * Generates a targeted feedback prompt for a 1-shot retry when JSON validation fails.
 */
export function buildRetryPrompt(originalPrompt: string, validationErrors: string[]): string {
  const formattedErrors = validationErrors.map(err => `- ${err}`).join('\n');

  return `${originalPrompt}

Your previous JSON response failed validation with the following errors:

Validation Errors:
${formattedErrors}

IMPORTANT RECOVERY INSTRUCTION:
Return ONLY the corrected, valid JSON object that fixes all errors listed above.
Do not write any text explanations or markdown blocks. The response must start with '{' or '[' and end with '}' or ']'.`;
}
