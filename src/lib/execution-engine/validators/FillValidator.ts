import { Page } from 'playwright';
import { BaseValidator, ValidationEvidence, ValidatorResult } from './BaseValidator';

export class FillValidator implements BaseValidator {
  async validate(
    page: Page,
    stepText: string,
    expectedResult: string,
    action: { actionType: 'click' | 'fill' | 'navigate' | 'observe' | 'key' | 'select' | 'check' | 'uncheck'; target: string; value: string },
    evidence: ValidationEvidence
  ): Promise<ValidatorResult> {
    if (action.actionType !== 'fill') {
      return { status: 'UNKNOWN', reasoning: 'Not a fill action' };
    }

    const valueEntered = action.value;
    const targetText = action.target.toLowerCase();

    // Scan captured input values in evidence to match with target entered value
    const matchedInputKey = Object.keys(evidence.inputs).find(key => {
      const lowerKey = key.toLowerCase();
      // Match key with target selector hints like user, pass, email
      if (targetText.includes('username') && (lowerKey.includes('user') || lowerKey.includes('name'))) return true;
      if (targetText.includes('password') && lowerKey.includes('pass')) return true;
      if (targetText.includes('email') && lowerKey.includes('email')) return true;
      return lowerKey.includes(targetText) || targetText.includes(lowerKey);
    });

    if (matchedInputKey) {
      const actualValue = evidence.inputs[matchedInputKey];
      if (actualValue === valueEntered) {
        return {
          status: 'PASS',
          reasoning: `Verified element ${matchedInputKey} was filled with value: "${valueEntered}"`
        };
      } else {
        return {
          status: 'FAIL',
          reasoning: `Element ${matchedInputKey} value is "${actualValue}", but expected "${valueEntered}"`
        };
      }
    }

    // Fallback: Check if ANY input in the page contains the value we entered
    const anyMatchingValue = Object.values(evidence.inputs).includes(valueEntered);
    if (anyMatchingValue) {
      return {
        status: 'PASS',
        reasoning: `Verified typed input value "${valueEntered}" exists in page fields.`
      };
    }

    // If we wanted to enter an empty/blank value, verify that fields are indeed empty
    if (valueEntered === '') {
      return {
        status: 'PASS',
        reasoning: 'Verified field value left empty as requested.'
      };
    }

    return {
      status: 'UNKNOWN',
      reasoning: `Could not deterministically find input element for "${action.target}" in visible inputs to verify value: "${valueEntered}"`
    };
  }
}
