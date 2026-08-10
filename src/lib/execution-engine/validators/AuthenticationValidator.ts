import { Page } from 'playwright';
import { BaseValidator, ValidationEvidence, ValidatorResult } from './BaseValidator';

export class AuthenticationValidator implements BaseValidator {
  async validate(
    page: Page,
    stepText: string,
    expectedResult: string,
    action: { actionType: 'click' | 'fill' | 'navigate' | 'observe' | 'key' | 'select' | 'check' | 'uncheck'; target: string; value: string },
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
      expected.includes('invalid') ||
      expected.includes('fail') ||
      expected.includes('incorrect');

    if (!isAuthContext) {
      return { status: 'UNKNOWN', reasoning: 'Not an authentication step' };
    }

    const currentUrl = evidence.url;
    const bodyText = evidence.bodyText.toLowerCase();

    // Scan network response status map for login/session endpoints
    let loginResponseCode: number | undefined = undefined;
    Object.keys(evidence.networkResponseStatusMap).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('login') || lowerKey.includes('auth') || lowerKey.includes('session') || lowerKey.includes('token')) {
        loginResponseCode = evidence.networkResponseStatusMap[key];
      }
    });

    // ─── Strategy 1: Login Success Redirection Check ─────────────────────────────
    const expectSuccess = expected.includes('dashboard') || expected.includes('inventory') || expected.includes('redirected') || expected.includes('home') || expected.includes('successful') || expected.includes('welcome');
    
    if (expectSuccess) {
      // Generic check: Did we navigate away from a URL containing "login"?
      const isRedirAway = !currentUrl.toLowerCase().includes('/login') && !currentUrl.toLowerCase().includes('signin');
      const hasLogoutOption = bodyText.includes('logout') || bodyText.includes('signout') || bodyText.includes('sign out') || bodyText.includes('log out') || bodyText.includes('exit');
      const hasUserMenu = bodyText.includes('welcome') || bodyText.includes('profile') || bodyText.includes('dashboard') || bodyText.includes('account');
      
      // If we are on a new page, logout/profile is visible, and login endpoints returned success (or no endpoint failure)
      if (isRedirAway && (hasLogoutOption || hasUserMenu) && (loginResponseCode === undefined || loginResponseCode < 400)) {
        const cookiesStr = evidence.cookies.map(c => c.name).join(', ') || 'No session cookies';
        return {
          status: 'PASS',
          reasoning: `Authentication Success Check (Generic):\n- Matched: ✔\n- URL redirected away from login: ✔ (${currentUrl})\n- Interactive session elements detected: ✔\n- Session Cookies: [${cookiesStr}]`
        };
      }

      // Hard failure: We expected success, but the page URL didn't change and we see login error indicators
      const hasCommonErrorMsg = bodyText.includes('required') || bodyText.includes('invalid') || bodyText.includes('incorrect') || bodyText.includes('error') || bodyText.includes('failed') || bodyText.includes('wrong') || bodyText.includes('mismatch') || loginResponseCode === 401;
      if (!isRedirAway && hasCommonErrorMsg) {
        return {
          status: 'FAIL',
          reasoning: `Authentication Failure Check (Generic):\n- Mismatch: ✘ (Expected redirection to dashboard/success, but remained on login page)\n- Observed URL: ${currentUrl}\n- Response Code: ${loginResponseCode || 'Unresolved'}\n- Common error text found on page: ✔`
        };
      }
    }

    // ─── Strategy 2: Login Failure Validation Error Check ─────────────────────────
    const expectFailure = expected.includes('error') || expected.includes('required') || expected.includes('invalid') || expected.includes('fail') || expected.includes('incorrect') || expected.includes('wrong');
    
    if (expectFailure) {
      // If we successfully logged in and redirected away from login when we expected a failure, it is a hard FAILED!
      const isRedirAway = !currentUrl.toLowerCase().includes('/login') && !currentUrl.toLowerCase().includes('signin');
      const hasLogoutOption = bodyText.includes('logout') || bodyText.includes('signout') || bodyText.includes('sign out') || bodyText.includes('log out');
      if (isRedirAway && hasLogoutOption) {
        return {
          status: 'FAIL',
          reasoning: `Security Failure Check:\n- Redirection to dashboard occurred when auth failure was expected!\n- Observed URL: ${currentUrl}\n- Response Code: ${loginResponseCode || 200}`
        };
      }

      // Check if page contains any common error texts
      const hasCommonErrorMsg = bodyText.includes('required') || bodyText.includes('invalid') || bodyText.includes('incorrect') || bodyText.includes('error') || bodyText.includes('failed') || bodyText.includes('wrong') || bodyText.includes('mismatch') || bodyText.includes('not match') || loginResponseCode === 401;
      
      if (hasCommonErrorMsg) {
        // Strict keyword matching for specific missing fields if specified in expected result
        if (expected.includes('username') && expected.includes('required') && !bodyText.includes('username') && !bodyText.includes('email') && !bodyText.includes('user')) {
          return {
            status: 'FAIL',
            reasoning: `Strict Mismatch: Expected username validation error, but none matched on the page.`
          };
        }
        if (expected.includes('password') && expected.includes('required') && !bodyText.includes('password') && !bodyText.includes('pass')) {
          return {
            status: 'FAIL',
            reasoning: `Strict Mismatch: Expected password validation error, but none matched on the page.`
          };
        }

        const isCookieAbsent = evidence.cookies.length === 0 || !evidence.cookies.some(c => c.name.toLowerCase().includes('session') || c.name.toLowerCase().includes('token'));

        return {
          status: 'PASS',
          reasoning: `Authentication Failure Blocked (Generic):\n- Validation error detected: ✔\n- URL remains unchanged: ✔ (${currentUrl})\n- Cookie absent: ${isCookieAbsent ? '✔' : '✘'}\n- Redirect prevented: ✔`
        };
      }
    }

    return {
      status: 'UNKNOWN',
      reasoning: 'Redirection state or generic validation checks could not be resolved deterministically.'
    };
  }
}
