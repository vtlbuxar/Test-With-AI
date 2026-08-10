import { Page } from 'playwright';
import { BaseValidator, ValidationEvidence, ValidatorResult } from './BaseValidator';

export class ClickValidator implements BaseValidator {
  async validate(
    page: Page,
    stepText: string,
    expectedResult: string,
    action: { actionType: 'click' | 'fill' | 'navigate' | 'observe' | 'key' | 'select' | 'check' | 'uncheck'; target: string; value: string },
    evidence: ValidationEvidence
  ): Promise<ValidatorResult> {
    if (action.actionType !== 'click') {
      return { status: 'UNKNOWN', reasoning: 'Not a click action' };
    }

    // A simple intermediate click is always UNKNOWN if it's the final assertion step.
    // Otherwise, if no specific expected UI outcome is described for this click in the expectedResult,
    // we assume clicking it without a page crash is sufficient to consider it successful.
    const text = stepText.toLowerCase();
    const isLoginButton = text.includes('login') || text.includes('submit') || text.includes('sign in');

    if (isLoginButton) {
      // Let the AuthenticationValidator handle authentication redirects/errors
      return {
        status: 'UNKNOWN',
        reasoning: 'Authentication click requires deep redirection/validation checks.'
      };
    }

    // For standard non-login clicks that completed without throwing an error, we mark it UNKNOWN
    // to allow the semantic/assertion checking to run if there is an expected result, or fall back to UNKNOWN.
    return {
      status: 'UNKNOWN',
      reasoning: 'Click action succeeded, deferring UI assertion to specialized validators or AI.'
    };
  }
}
