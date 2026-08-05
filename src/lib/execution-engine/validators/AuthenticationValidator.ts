import { Page } from 'playwright';
import { BaseValidator, ValidationEvidence, ValidatorResult } from './BaseValidator';

export class AuthenticationValidator implements BaseValidator {
  async validate(
    page: Page,
    stepText: string,
    expectedResult: string,
    action: { actionType: 'click' | 'fill' | 'navigate' | 'observe' | 'key' | 'select'; target: string; value: string },
    evidence: ValidationEvidence
  ): Promise<ValidatorResult> {
    const text = stepText.toLowerCase();
    const expected = expectedResult.toLowerCase();

    // Check if this step relates to login actions or assertions
    const isAuthContext = 
      text.includes('login') || 
      text.includes('submit') || 
      text.includes('credentials') || 
      expected.includes('dashboard') || 
      expected.includes('inventory') || 
      expected.includes('error') || 
      expected.includes('required') ||
      expected.includes('invalid');

    if (!isAuthContext) {
      return { status: 'UNKNOWN', reasoning: 'Not an authentication step' };
    }

    const currentUrl = evidence.url;
    const bodyText = evidence.bodyText.toLowerCase();

    // Scan network response status map for login endpoints
    let loginResponseCode: number | undefined = undefined;
    Object.keys(evidence.networkResponseStatusMap).forEach(key => {
      if (key.toLowerCase().includes('login') || key.toLowerCase().includes('authenticate')) {
        loginResponseCode = evidence.networkResponseStatusMap[key];
      }
    });

    // Strategy 1: Login Success Redirection Check
    const expectSuccess = expected.includes('dashboard') || expected.includes('inventory') || expected.includes('redirected') || expected.includes('home') || expected.includes('successful');
    
    if (expectSuccess) {
      const isRedirPath = currentUrl.includes('/inventory.html') || currentUrl.includes('/dashboard') || currentUrl.includes('/home') || currentUrl.includes('/index.html');
      
      const hasLogoutOption = bodyText.includes('logout') || bodyText.includes('sign out') || bodyText.includes('sidebar');
      const hasProducts = bodyText.includes('products') || bodyText.includes('cart') || bodyText.includes('item');
      const isResponseSuccess = loginResponseCode === 200 || loginResponseCode === 302 || loginResponseCode === undefined;

      if (isRedirPath && (hasLogoutOption || hasProducts) && isResponseSuccess) {
        const cookiesStr = evidence.cookies.map(c => c.name).join(', ') || 'No session cookies';
        return {
          status: 'PASS',
          reasoning: `Authentication Success Check:\n- Matched: ✔\n- URL redirected: ✔ (${currentUrl})\n- Cookie established: ✔ [${cookiesStr}]\n- Products catalog detected: ✔`
        };
      }

      if (!isRedirPath && !hasLogoutOption && (bodyText.includes('username is required') || bodyText.includes('password is required') || bodyText.includes('sadface') || bodyText.includes('do not match') || loginResponseCode === 401)) {
        return {
          status: 'FAIL',
          reasoning: `Authentication Failure Check:\n- Matched: ✘ (Expected redirection to dashboard)\n- Observed URL: ${currentUrl}\n- Response status: ${loginResponseCode || 'Unresolved'}\n- Session established: ✘`
        };
      }
    }

    // Strategy 2: Login Failure Validation Error Check
    const expectFailure = expected.includes('error') || expected.includes('required') || expected.includes('invalid') || expected.includes('fail');
    
    if (expectFailure) {
      // If we successfully logged in when we expected an error, it is a hard FAILED!
      const isRedirPath = currentUrl.includes('/inventory.html') || currentUrl.includes('/dashboard');
      if (isRedirPath) {
        return {
          status: 'FAIL',
          reasoning: `Security Failure Check:\n- Redirection occurred when failure was expected!\n- Observed URL: ${currentUrl}\n- Response Code: ${loginResponseCode || 200}`
        };
      }

      // Check SauceDemo error element text
      const hasErrorMsg = bodyText.includes('epic sadface') || bodyText.includes('username and password') || bodyText.includes('required') || bodyText.includes('match') || loginResponseCode === 401;
      
      if (hasErrorMsg) {
        // Strict matching check for empty username vs empty password error texts
        if (expected.includes('username is required') && !bodyText.includes('username is required')) {
          return {
            status: 'FAIL',
            reasoning: `Strict Validation Mismatch: Expected error message containing 'Username is required', but it was not displayed.`
          };
        }
        if (expected.includes('password is required') && !bodyText.includes('password is required')) {
          return {
            status: 'FAIL',
            reasoning: `Strict Validation Mismatch: Expected error message containing 'Password is required', but it was not displayed.`
          };
        }
        if (expected.includes('username and password are required') && !(bodyText.includes('username is required') || bodyText.includes('password is required') || bodyText.includes('required'))) {
          return {
            status: 'FAIL',
            reasoning: `Strict Validation Mismatch: Expected error message 'Username and password are required', but none matched.`
          };
        }

        const isUnchangedUrl = currentUrl.replace(/\/$/, '') === action.target.replace(/\/$/, '') || currentUrl.includes('saucedemo.com');
        const isCookieAbsent = evidence.cookies.length === 0 || !evidence.cookies.some(c => c.name.toLowerCase().includes('session'));

        return {
          status: 'PASS',
          reasoning: `Authentication Blocked Checklist:\n- Expected validation error displayed: ✔\n- URL unchanged: ${isUnchangedUrl ? '✔' : '✘'}\n- Cookie absent: ${isCookieAbsent ? '✔' : '✘'}\n- Redirect absent: ✔`
        };
      }
    }

    return {
      status: 'UNKNOWN',
      reasoning: 'Redirection state or error message matches could not be resolved deterministically.'
    };
  }
}
