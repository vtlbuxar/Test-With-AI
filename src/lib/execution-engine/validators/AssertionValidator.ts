import { Page } from 'playwright';
import { BaseValidator, ValidationEvidence, ValidatorResult } from './BaseValidator';

export class AssertionValidator implements BaseValidator {
  async validate(
    page: Page,
    stepText: string,
    expectedResult: string,
    action: { actionType: 'click' | 'fill' | 'navigate' | 'observe' | 'key' | 'select' | 'check' | 'uncheck'; target: string; value: string },
    evidence: ValidationEvidence
  ): Promise<ValidatorResult> {
    const text = stepText.toLowerCase();
    const expected = expectedResult.toLowerCase();

    // Determine if this is a verification/assertion step
    const isAssertion =
      action.actionType === 'observe' ||
      text.includes('verify') ||
      text.includes('assert') ||
      text.includes('check') ||
      text.includes('should be') ||
      text.includes('is displayed') ||
      expected.includes('should') ||
      expected.includes('verify') ||
      expected.includes('expect');

    if (!isAssertion) {
      return { status: 'UNKNOWN', reasoning: 'Not a verification/assertion step' };
    }

    // ─── 0. API / NETWORK ASSERTIONS ─────────────────────────────────────────
    if (text.includes('status') || text.includes('response.body') || expected.includes('status') || expected.includes('body') || expected.includes('response')) {
      const payloads = evidence.responseBodies || {};
      
      // Look for status code assertions (e.g. status == 401, status is 200)
      const matchStatus = expected.match(/status\s*(==|===|is)\s*(\d{3})/i) || text.match(/status\s*(==|===|is)\s*(\d{3})/i) || expected.match(/(\d{3})\s*status/i);
      if (matchStatus) {
        const expectedStatus = parseInt(matchStatus[2] || matchStatus[1], 10);
        const foundMatchingStatus = Object.values(evidence.networkResponseStatusMap).includes(expectedStatus);
        if (foundMatchingStatus) {
          return {
            status: 'PASS',
            reasoning: `API Status Verification Succeeded: Found response with expected HTTP status ${expectedStatus}.`
          };
        } else {
          return {
            status: 'FAIL',
            reasoning: `API Status Verification Failed: Expected HTTP status ${expectedStatus}, but observed statuses: ${JSON.stringify(evidence.networkResponseStatusMap)}`
          };
        }
      }

      // Look for JSON body text contains assertions
      const quotedJSONPart = expected.match(/body\.error\s*(==|===|contains|is)\s*["'“‘”’]([^"'“‘”’]+)["'“‘”’]/i) || expected.match(/["'“‘”’]([^"'“‘”’]+)["'“‘”’]/) || text.match(/["'“‘”’]([^"'“‘”’]+)["'“‘”’]/);
      if (quotedJSONPart) {
        const expectedBodyText = quotedJSONPart[quotedJSONPart.length - 1].toLowerCase();
        const matchesPayload = Object.values(payloads).some(body => body.toLowerCase().includes(expectedBodyText));
        
        if (matchesPayload) {
          return {
            status: 'PASS',
            reasoning: `API Response Body Verification Succeeded: Observed payload contains expected content "${quotedJSONPart[quotedJSONPart.length - 1]}".`
          };
        } else {
          return {
            status: 'FAIL',
            reasoning: `API Response Body Verification Failed: Expected payload to contain "${quotedJSONPart[quotedJSONPart.length - 1]}", but observed payloads do not contain it.`
          };
        }
      }
    }

    // ─── 1. URL ASSERTIONS ───────────────────────────────────────────────────
    if (text.includes('url') || expected.includes('url') || text.includes('redirect')) {
      const matchUrl = expected.match(/https?:\/\/[^\s"']+/i) || text.match(/https?:\/\/[^\s"']+/i);
      if (matchUrl) {
        const expectedUrl = matchUrl[0].replace(/\/$/, '').toLowerCase();
        const currentUrl = evidence.url.replace(/\/$/, '').toLowerCase();
        if (currentUrl === expectedUrl || currentUrl.includes(expectedUrl)) {
          return {
            status: 'PASS',
            reasoning: `URL Verification Succeeded: Current URL "${evidence.url}" matches expected target "${matchUrl[0]}".`
          };
        } else {
          return {
            status: 'FAIL',
            reasoning: `URL Verification Failed: Expected URL to match or contain "${matchUrl[0]}", but observed current URL "${evidence.url}".`
          };
        }
      }
    }

    // ─── 2. INPUT VALUE ASSERTIONS ───────────────────────────────────────────
    if (text.includes('value') || text.includes('input') || text.includes('enter') || expected.includes('value') || expected.includes('input')) {
      // Find quoted value in step or expected results
      const quoteMatch = expected.match(/["'“‘”’]([^"'“‘”’]+)["'“‘”’]/) || text.match(/["'“‘”’]([^"'“‘”’]+)["'“‘”’]/);
      if (quoteMatch) {
        const expectedValue = quoteMatch[1];
        
        // Scan evidence.inputs or formValues to find any input containing the expected value
        const foundMatch = Object.entries(evidence.inputs).find(([key, val]) => {
          return val === expectedValue || val.includes(expectedValue);
        });

        if (foundMatch) {
          return {
            status: 'PASS',
            reasoning: `Input Value Verification Succeeded: Field "${foundMatch[0]}" matches expected value "${expectedValue}".`
          };
        } else if (expectedValue !== '') {
          // Only fail if we expected a non-empty value and didn't find it
          return {
            status: 'FAIL',
            reasoning: `Input Value Verification Failed: Expected value "${expectedValue}" not found in any inputs. Current inputs: ${JSON.stringify(evidence.inputs)}`
          };
        }
      }
    }

    // ─── 2.5. CHECKBOX / RADIO ASSERTIONS ────────────────────────────────────
    if (text.includes('checkbox') || text.includes('agree') || text.includes('terms') || text.includes('policy') || text.includes('radio') || expected.includes('checked') || expected.includes('selected')) {
      const expectChecked = expected.includes('checked') || expected.includes('selected') || text.includes('checked') || text.includes('selected');
      const expectUnchecked = expected.includes('unchecked') || expected.includes('unselected') || text.includes('unchecked') || text.includes('unselected');
      
      if (expectChecked || expectUnchecked) {
        const keywords = text
          .replace(/verify|check|assert|visible|displayed|exists|the|is|on|screen|page|checked|unchecked|selected|unselected/g, ' ')
          .split(/\s+/)
          .map(k => k.trim())
          .filter(k => k.length > 2);

        const matchEntry = Object.entries(evidence.inputs).find(([key]) => {
          const lowerKey = key.toLowerCase();
          return keywords.some(kw => lowerKey.includes(kw)) || lowerKey.includes('checkbox') || lowerKey.includes('radio');
        });

        if (matchEntry) {
          const isChecked = matchEntry[1] === 'true';
          if (expectChecked && isChecked) {
            return {
              status: 'PASS',
              reasoning: `Checkbox/Radio Verification Succeeded: Field "${matchEntry[0]}" is checked as expected.`
            };
          } else if (expectUnchecked && !isChecked) {
            return {
              status: 'PASS',
              reasoning: `Checkbox/Radio Verification Succeeded: Field "${matchEntry[0]}" is unchecked as expected.`
            };
          } else {
            return {
              status: 'FAIL',
              reasoning: `Checkbox/Radio Verification Failed: Expected field "${matchEntry[0]}" to be ${expectChecked ? 'checked' : 'unchecked'}, but it was ${isChecked ? 'checked' : 'unchecked'}.`
            };
          }
        }
      }
    }

    // ─── 3. TEXT / CONTENT ASSERTIONS ────────────────────────────────────────
    // If expectedResult or stepText contains quoted text, verify its presence
    const quotedPhrase = expected.match(/["'“‘”’]([^"'“‘”’]+)["'“‘”’]/) || text.match(/["'“‘”’]([^"'“‘”’]+)["'“‘”’]/);
    if (quotedPhrase) {
      const expectedText = quotedPhrase[1].toLowerCase().trim();
      const body = evidence.bodyText.toLowerCase();

      if (body.includes(expectedText)) {
        return {
          status: 'PASS',
          reasoning: `Text Verification Succeeded: Observed page body contains expected phrase "${quotedPhrase[1]}".`
        };
      } else {
        return {
          status: 'FAIL',
          reasoning: `Text Verification Failed: Page body does not contain expected phrase "${quotedPhrase[1]}".`
        };
      }
    }

    // ─── 4. ELEMENT VISIBILITY / EXISTENCE ASSERTIONS ───────────────────────
    if (text.includes('visible') || text.includes('displayed') || text.includes('exists') || expected.includes('visible') || expected.includes('displayed')) {
      // Try to find elements matching key words in step text
      const targetKeywords = text
        .replace(/verify|check|assert|visible|displayed|exists|the|is|on|screen|page/g, ' ')
        .split(/\s+/)
        .map(k => k.trim())
        .filter(k => k.length > 2);

      if (targetKeywords.length > 0) {
        const matchesVisible = evidence.visibleElements.some(selector => {
          const lowerSel = selector.toLowerCase();
          return targetKeywords.some(kw => lowerSel.includes(kw));
        });

        if (matchesVisible) {
          return {
            status: 'PASS',
            reasoning: `Visibility Verification Succeeded: Element matching keywords [${targetKeywords.join(', ')}] is visible on page.`
          };
        } else {
          return {
            status: 'FAIL',
            reasoning: `Visibility Verification Failed: No visible elements match target keywords [${targetKeywords.join(', ')}].`
          };
        }
      }
    }

    // Fallback: Check general body presence for common error text patterns
    const errorKeywords = ['error', 'invalid', 'required', 'failed', 'incorrect', 'mismatch', 'wrong'];
    const expectedError = errorKeywords.some(kw => expected.includes(kw) || text.includes(kw));
    if (expectedError) {
      const pageHasErrorText = errorKeywords.some(kw => evidence.bodyText.toLowerCase().includes(kw));
      if (pageHasErrorText) {
        return {
          status: 'PASS',
          reasoning: `Error Assert Checked: Page body contains error indicator text.`
        };
      } else {
        return {
          status: 'FAIL',
          reasoning: `Error Assert Checked: Expected validation error, but no error keywords were found in page body.`
        };
      }
    }

    return {
      status: 'UNKNOWN',
      reasoning: 'Assertion details did not match any deterministic layout, visibility, or text pattern rules.'
    };
  }
}
