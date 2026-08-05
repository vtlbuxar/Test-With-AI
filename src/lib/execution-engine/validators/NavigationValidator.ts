import { Page } from 'playwright';
import { BaseValidator, ValidationEvidence, ValidatorResult } from './BaseValidator';

export class NavigationValidator implements BaseValidator {
  async validate(
    page: Page,
    stepText: string,
    expectedResult: string,
    action: { actionType: 'click' | 'fill' | 'navigate' | 'observe' | 'key' | 'select'; target: string; value: string },
    evidence: ValidationEvidence
  ): Promise<ValidatorResult> {
    if (action.actionType !== 'navigate') {
      return { status: 'UNKNOWN', reasoning: 'Not a navigation action' };
    }

    const currentUrl = evidence.url;
    const targetUrl = action.target;

    // Check if URL matches (even partially, e.g. subdomain/https/port variances)
    const cleanCurrent = currentUrl.replace(/\/$/, '').toLowerCase();
    const cleanTarget = targetUrl.replace(/\/$/, '').toLowerCase();

    if (cleanCurrent.includes(cleanTarget) || cleanTarget.includes(cleanCurrent)) {
      if (evidence.httpStatus && evidence.httpStatus >= 400) {
        return {
          status: 'FAIL',
          reasoning: `Navigation resolved but returned HTTP server error: ${evidence.httpStatus}`
        };
      }
      return {
        status: 'PASS',
        reasoning: `Successfully navigated to and loaded: ${currentUrl}`
      };
    }

    return {
      status: 'UNKNOWN',
      reasoning: `Navigated to ${currentUrl}, but could not confirm match with target URL: ${targetUrl}`
    };
  }
}
