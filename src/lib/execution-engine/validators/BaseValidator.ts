import { Page } from 'playwright';

export interface ValidationEvidence {
  url: string;
  title: string;
  cookies: any[];
  consoleLogs: string[];
  networkLogs: string[];
  focusedElementSelector: string | null;
  inputs: Record<string, string>;
  visibleElements: string[];
  hiddenElements: string[];
  ariaTree: string;
  bodyText: string;
  httpStatus?: number;
  buttons: string[];
  links: string[];
  disabledElements: string[];
  formValues: Record<string, string>;
  networkResponseStatusMap: Record<string, number>;
  responseBodies?: Record<string, string>; // selective network payload capture
}

export interface ValidatorResult {
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  reasoning: string;
}

export interface BaseValidator {
  validate(
    page: Page,
    stepText: string,
    expectedResult: string,
    action: { actionType: 'click' | 'fill' | 'navigate' | 'observe' | 'key' | 'select' | 'check' | 'uncheck'; target: string; value: string },
    evidence: ValidationEvidence
  ): Promise<ValidatorResult>;
}
