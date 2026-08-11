import prisma from '@/lib/prisma';
import { queueManager, ExecutionJob, RunControlState } from './queue';
import { chromium, firefox, webkit, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { collectEvidence } from './evidence-collector';
import { BaseValidator, ValidationEvidence, ValidatorResult } from './validators/BaseValidator';
import { NavigationValidator } from './validators/NavigationValidator';
import { FillValidator } from './validators/FillValidator';
import { ClickValidator } from './validators/ClickValidator';
import { AuthenticationValidator } from './validators/AuthenticationValidator';
import { LayoutValidator } from './validators/LayoutValidator';

// Ensure directories exist
const SCREENSHOT_DIR = path.join(process.cwd(), 'public', 'storage', 'test-runs', 'screenshots');
const VIDEO_DIR = path.join(process.cwd(), 'public', 'storage', 'test-runs', 'videos');
const LOG_DIR = path.join(process.cwd(), 'public', 'storage', 'test-runs', 'logs');

function ensureDirectories() {
  [SCREENSHOT_DIR, VIDEO_DIR, LOG_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

async function isElementVisible(page: Page, selector: string): Promise<boolean> {
  try {
    const handle = await page.$(selector);
    return handle ? await handle.isVisible() : false;
  } catch (e) {
    return false;
  }
}

// Selector search hierarchy helper
async function locateElementDirect(page: Page, actionDetail: string): Promise<string | null> {
  const cleanDetail = actionDetail.replace(/['"]/g, '').trim();

  // Try common strategies sequentially
  const selectorStrategies = [
    `[data-testid="${cleanDetail}"]`,
    `[aria-label="${cleanDetail}"]`,
    `#${cleanDetail}`,
    `[name="${cleanDetail}"]`,
    `[role="${cleanDetail}"]`,
    `text=${cleanDetail}`,
    `input[placeholder*="${cleanDetail}"]`,
    `button:has-text("${cleanDetail}")`,
    `a:has-text("${cleanDetail}")`
  ];

  for (const selector of selectorStrategies) {
    if (await isElementVisible(page, selector)) return selector;
  }

  // Attempt CSS selectors or XPath as last resorts
  if (await isElementVisible(page, cleanDetail)) return cleanDetail;

  return null;
}

// Locate dropdown <select> elements generically using label text matching
async function locateDropdown(page: Page, actionDetail: string): Promise<string | null> {
  // Extract meaningful keywords from the step text to match against <label> or aria-label
  const keywords = actionDetail
    .toLowerCase()
    .replace(/select|choose|pick|the|from|a|an|valid|same|different|city|option|dropdown|value/g, ' ')
    .split(/\s+/)
    .map(k => k.trim())
    .filter(k => k.length > 2);

  // Strategy 1: Find <select> whose <label> text contains a keyword from the step
  const result = await page.evaluate((keywords: string[]) => {
    const selects = Array.from(document.querySelectorAll('select'));
    for (const sel of selects) {
      const id = sel.id;
      const name = sel.name || '';
      const ariaLabel = sel.getAttribute('aria-label') || '';
      const placeholder = sel.getAttribute('placeholder') || '';

      // Find associated label
      let labelText = '';
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) labelText = label.textContent || '';
      }
      if (!labelText) {
        const parent = sel.closest('label');
        if (parent) labelText = parent.textContent || '';
      }

      const combined = `${labelText} ${ariaLabel} ${name} ${placeholder}`.toLowerCase();

      const matches = keywords.some(kw => combined.includes(kw));
      if (matches) {
        // Return a unique selector for this element
        if (id) return `#${id}`;
        if (name) return `select[name="${name}"]`;
        return 'select';
      }
    }
    return null;
  }, keywords).catch(() => null);

  if (result) return result;

  // Strategy 2: Find any visible <select> on the page as fallback
  const allSelects = await page.$$('select');
  for (const sel of allSelects) {
    if (await sel.isVisible()) {
      const id = await sel.getAttribute('id');
      if (id) return `#${id}`;
      const name = await sel.getAttribute('name');
      if (name) return `select[name="${name}"]`;
      return 'select';
    }
  }

  return null;
}

// Main Selector Search with generic semantic label + attribute matching
async function locateElement(page: Page, actionDetail: string): Promise<string | null> {
  const directSelector = await locateElementDirect(page, actionDetail);
  if (directSelector) return directSelector;

  const cleanTarget = actionDetail.toLowerCase();

  // Extract meaningful keywords from action text
  const keywords = cleanTarget
    .replace(/click|press|the|a|an|on|button|link|input|field|into|and|with|to|of|valid|invalid|same|different|empty|blank|mandatory|required/g, ' ')
    .split(/\s+/)
    .map(k => k.trim())
    .filter(k => k.length > 2);

  // Strategy: Find interactive elements whose label/aria/placeholder/value/text matches keywords
  const found = await page.evaluate((keywords: string[]) => {
    const candidates = Array.from(document.querySelectorAll(
      'button, input, a, textarea, [role="button"], [role="link"], [role="textbox"]'
    ));

    for (const el of candidates as HTMLElement[]) {
      const tag = el.tagName.toLowerCase();
      const id = el.id || '';
      const name = (el as any).name || '';
      const type = (el as any).type || '';
      const placeholder = (el as any).placeholder || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const innerText = el.innerText || '';
      const value = (el as any).value || '';

      // Check associated label
      let labelText = '';
      if (id) {
        const lbl = document.querySelector(`label[for="${id}"]`);
        if (lbl) labelText = (lbl as HTMLElement).innerText || '';
      }
      if (!labelText) {
        const parent = el.closest('label');
        if (parent) labelText = (parent as HTMLElement).innerText || '';
      }

      const haystack = `${id} ${name} ${placeholder} ${ariaLabel} ${innerText} ${value} ${labelText}`.toLowerCase();

      const score = keywords.filter(kw => haystack.includes(kw)).length;
      if (score > 0 && el.offsetParent !== null) {
        if (id) return `#${id}`;
        if (name && tag === 'input') return `input[name="${name}"]`;
        if (name && tag === 'textarea') return `textarea[name="${name}"]`;
        if (innerText && (tag === 'button' || tag === 'a')) return `${tag}:has-text("${innerText.trim().slice(0, 30)}")`;
        if (type === 'submit' || type === 'button') return `input[value="${value}"]`;
      }
    }
    return null;
  }, keywords).catch(() => null);

  if (found) return found;

  // Fallback patterns for very common UI elements by semantic role
  if (cleanTarget.includes('username') || cleanTarget.includes('email') || cleanTarget.includes('user')) {
    for (const sel of ['input[id*="user"]', 'input[id*="email"]', 'input[name*="user"]', 'input[name*="email"]',
      'input[placeholder*="username" i]', 'input[placeholder*="email" i]', 'input[type="email"]', 'input[type="text"]:first-of-type']) {
      if (await isElementVisible(page, sel)) return sel;
    }
  }

  if (cleanTarget.includes('password') || cleanTarget.includes('pass')) {
    for (const sel of ['input[type="password"]', 'input[id*="pass"]', 'input[name*="pass"]',
      'input[placeholder*="password" i]']) {
      if (await isElementVisible(page, sel)) return sel;
    }
  }

  if (cleanTarget.includes('login') || cleanTarget.includes('sign in')) {
    for (const sel of ['#login-button', 'input[type="submit"]', 'button[type="submit"]',
      'button:has-text("Login")', 'button:has-text("Sign In")',
      'input[value*="Login" i]', 'input[value*="Sign" i]']) {
      if (await isElementVisible(page, sel)) return sel;
    }
  }

  if (cleanTarget.includes('search') || cleanTarget.includes('find')) {
    for (const sel of ['input[type="submit"]', 'button[type="submit"]',
      'input[value*="Search" i]', 'input[value*="Find" i]',
      'button:has-text("Search")', 'button:has-text("Find")']) {
      if (await isElementVisible(page, sel)) return sel;
    }
  }

  if (cleanTarget.includes('submit') || cleanTarget.includes('purchase') || cleanTarget.includes('confirm') || cleanTarget.includes('complete')) {
    for (const sel of ['input[type="submit"]', 'button[type="submit"]',
      'input[value*="Submit" i]', 'input[value*="Purchase" i]', 'input[value*="Confirm" i]',
      'button:has-text("Submit")', 'button:has-text("Purchase")', 'button:has-text("Confirm")']) {
      if (await isElementVisible(page, sel)) return sel;
    }
  }

  if (cleanTarget.includes('book') || cleanTarget.includes('choose') || cleanTarget.includes('select')) {
    for (const sel of ['input[value*="Choose" i]', 'input[value*="Book" i]', 'input[value*="Select" i]',
      'button:has-text("Choose")', 'button:has-text("Book")', 'button:has-text("Select")']) {
      if (await isElementVisible(page, sel)) return sel;
    }
  }

  return null;
}

// Action text parsing helper
export function parseSubAction(subStep: string, websiteUrl: string): { actionType: 'click' | 'fill' | 'navigate' | 'observe' | 'key' | 'select', target: string, value: string } {
  const text = subStep.toLowerCase();
  
  let actionType: 'click' | 'fill' | 'navigate' | 'observe' | 'key' | 'select' = 'click';
  let target = '';
  let value = '';

  // Check observe/verify
  if (text.includes('observe') || text.includes('verify') || text.includes('confirm') || text.includes('assert') || text.includes('check') || text.includes('should be') || text.includes('is displayed') || text.includes('layout') || text.includes('functionality') || text.includes('measure') || text.includes('ensure')) {
    actionType = 'observe';
    target = subStep;
  }
  // *** KEYBOARD: Only match EXPLICIT "press X key" / "use Tab" / "hit Enter" patterns ***
  // NOT bare "Enter valid X" (which is a fill verb) or "Enter same X" etc.
  else if (
    /\bpress\s+(the\s+)?(tab|enter|space|esc|escape|arrow|ctrl|shift|alt|backspace|delete|f\d)/i.test(text) ||
    /\buse\s+(the\s+)?(tab|enter|space|esc|escape)\s*key/i.test(text) ||
    /\bhit\s+(the\s+)?(tab|enter|space|esc|escape)/i.test(text) ||
    /\bkeyboard\.press/i.test(text) ||
    /\b(tab key|enter key|space key|escape key|esc key)\b/i.test(text)
  ) {
    actionType = 'key';
    target = subStep;
    if (/\btab\b/i.test(text)) {
      value = 'Tab';
    } else if (/\benter\b/i.test(text)) {
      value = 'Enter';
    } else if (/\bspace\b/i.test(text)) {
      value = 'Space';
    } else if (/\besc(ape)?\b/i.test(text)) {
      value = 'Escape';
    } else if (/\barrow\s*down\b/i.test(text)) {
      value = 'ArrowDown';
    } else if (/\barrow\s*up\b/i.test(text)) {
      value = 'ArrowUp';
    } else if (/\bctrl\+a\b/i.test(text)) {
      value = 'Control+A';
    } else if (/\bshift\+tab\b/i.test(text)) {
      value = 'Shift+Tab';
    } else {
      value = 'Tab'; // default keyboard fallback
    }
  }
  // Check navigate
  else if (text.includes('navigate') || text.includes('open') || text.includes('go to') || text.includes('launch') || text.includes('access')) {
    actionType = 'navigate';
    const match = subStep.match(/https?:\/\/[^\s]+/);
    target = match ? match[0] : websiteUrl;
  }
  // Check dropdown select — any step mentioning select/choose/pick on a dropdown/list/option
  else if (
    (text.includes('select') || text.includes('choose') || text.includes('pick')) &&
    (text.includes('option') || text.includes('dropdown') || text.includes('list') ||
     text.includes('city') || text.includes('departure') || text.includes('destination') ||
     text.includes('country') || text.includes('state') || text.includes('category') ||
     text.includes('type') || text.includes('role') || text.includes('gender'))
  ) {
    actionType = 'select';
    target = subStep;
    // Leave value empty — runtime will resolve actual options from the DOM
    if (text.includes('empty') || text.includes('leave') || text.includes('blank')) {
      value = '__EMPTY_SELECTION__';
    } else if (text.includes('same') || text.includes('identical')) {
      value = '__SAME_AS_PREVIOUS__'; // runtime will re-use last selected value
    } else if (text.includes('different') || text.includes('other')) {
      value = '__DIFFERENT_FROM_PREVIOUS__';
    } else if (text.includes('invalid')) {
      value = '__INVALID_OPTION__';
    } else {
      value = '__AUTO_PICK__'; // runtime picks first valid option from DOM
    }
  }
  // Check fill/type — 'enter' here means fill verb ("Enter the username") NOT keyboard key
  else if (text.includes('enter') || text.includes('type') || text.includes('fill') || text.includes('input') || text.includes('leave') || text.includes('password') || text.includes('username')) {
    actionType = 'fill';
    
    // Extract quoted value if present
    const quotedMatch = subStep.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      value = quotedMatch[1];
    } else {
      // Guess value based on semantic context
      if (text.includes('empty') || text.includes('leave') || text.includes('blank') || text.includes('without credentials')) {
        value = '';
      } else if (text.includes('maximum allowed') || text.includes('exceeding') || text.includes('limit')) {
        value = 'standard_user_long_character_string_that_exceeds_sixty_characters_limit';
      } else if (text.includes('minimum allowed')) {
        value = 's';
      } else if (text.includes('sql injection')) {
        value = "' OR '1'='1";
      } else if (text.includes('xss')) {
        value = "<script>alert('xss')</script>";
      } else if (text.includes('special characters')) {
        value = "user!@#$%";
      } else if (text.includes('invalid username')) {
        value = 'invalid_user_exceeding_chars';
      } else if (text.includes('invalid password')) {
        value = 'invalid_password';
      } else if (text.includes('non-numeric') || text.includes('non numeric')) {
        value = 'ABCXYZ';
      } else if (text.includes('zip code') || text.includes('postal')) {
        value = 'INVALID_ZIP';
      } else if (text.includes('credit card')) {
        value = 'NOT-A-CARD';
      } else if (text.includes('first name') || text.includes('firstname')) {
        value = 'John';
      } else if (text.includes('last name') || text.includes('lastname')) {
        value = 'Doe';
      } else if (text.includes('address')) {
        value = '123 Main Street';
      } else if (text.includes('city')) {
        value = 'New York';
      } else if (text.includes('username') || text.includes('user')) {
        value = 'standard_user';
      } else if (text.includes('password') || text.includes('pass')) {
        value = 'secret_sauce';
      } else {
        value = 'standard_user';
      }
    }
    target = subStep;
  }
  // Check click
  else {
    actionType = 'click';
    target = subStep;
  }

  return { actionType, target, value };
}

// Action retry decorator helper
async function performActionWithRetry(
  page: Page,
  actionType: 'click' | 'fill' | 'navigate' | 'observe' | 'key' | 'select',
  target: string,
  value?: string
): Promise<void> {
  if (actionType === 'observe') {
    return;
  }
  
  // Enforce retry limits dynamically by action type
  const allowedRetries = (actionType === 'fill' || actionType === 'select') ? 1 : 3;
  let attempt = 0;
  
  while (attempt < allowedRetries) {
    try {
      if (actionType === 'navigate') {
        await page.goto(target, { waitUntil: 'load', timeout: 15000 });
        return;
      }

      if (actionType === 'key') {
        await page.keyboard.press(value || 'Tab');
        return;
      }

      if (actionType === 'select') {
        const dropdownSelector = await locateDropdown(page, target);
        if (!dropdownSelector) {
          throw new Error(`Could not locate dropdown element matching: "${target}"`);
        }

        // Resolve the actual option value from the DOM at runtime
        const resolvedValue = await page.evaluate(({ sel, hint, lastValue }: { sel: string, hint: string, lastValue: string }) => {
          const el = document.querySelector(sel) as HTMLSelectElement | null;
          if (!el) return null;
          const options = Array.from(el.options).filter(o => o.value && o.value !== el.options[0]?.value);
          if (options.length === 0) return null;
          if (hint === '__EMPTY_SELECTION__') return '';
          if (hint === '__AUTO_PICK__' || hint === '') return options[0].text;
          if (hint === '__SAME_AS_PREVIOUS__') return lastValue || options[0].text;
          if (hint === '__DIFFERENT_FROM_PREVIOUS__') {
            const diff = options.find(o => o.text !== lastValue);
            return diff ? diff.text : options[options.length - 1].text;
          }
          if (hint === '__INVALID_OPTION__') {
            return options[options.length - 1].text;
          }
          const match = options.find(o => o.text.toLowerCase().includes(hint.toLowerCase()));
          return match ? match.text : options[0].text;
        }, { sel: dropdownSelector, hint: value || '__AUTO_PICK__', lastValue: '' }).catch(() => null);

        if (resolvedValue !== null && resolvedValue !== undefined) {
          if (resolvedValue === '') {
            // Leave default selection (no change needed)
          } else {
            await page.selectOption(dropdownSelector, { label: resolvedValue }).catch(async () => {
              await page.selectOption(dropdownSelector, { value: resolvedValue }).catch(() => {});
            });
          }
        }
        return;
      }

      const selector = await locateElement(page, target);
      if (!selector) {
        throw new Error(`Could not locate element matching semantic targets in action text: "${target}"`);
      }

      if (actionType === 'click') {
        // State-Based Execution: Wait for navigation or state transitions
        const currentUrl = page.url();
        await page.click(selector, { timeout: 5000 });
        
        // Wait up to 2.5s for URL change or loading spinners to vanish
        try {
          await page.waitForURL((url) => url.toString() !== currentUrl, { timeout: 2500 });
        } catch (e) {
          // If no navigation, check if there's a visible loader or dialog
          await page.waitForSelector('.spinner, .loader, [data-test="error"]', { state: 'visible', timeout: 500 }).catch(() => {});
        }
      } else if (actionType === 'fill') {
        await page.fill(selector, value || '', { timeout: 5000 });
      }
      return; // Success
    } catch (e: any) {
      attempt++;
      if (attempt >= allowedRetries) {
        throw new Error(`Action failed after ${allowedRetries} attempts. Error: ${e.message}`);
      }
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, attempt * 1500));
    }
  }
}

// Pluggable Rule Engine Orchestrator
async function runRuleEngine(
  page: Page,
  stepText: string,
  expectedResult: string,
  action: { actionType: 'click' | 'fill' | 'navigate' | 'observe' | 'key' | 'select'; target: string; value: string },
  evidence: ValidationEvidence
): Promise<ValidatorResult> {
  const validators: BaseValidator[] = [
    new AuthenticationValidator(),
    new LayoutValidator(),
    new NavigationValidator(),
    new FillValidator(),
    new ClickValidator()
  ];

  for (const validator of validators) {
    try {
      const result = await validator.validate(page, stepText, expectedResult, action, evidence);
      if (result.status !== 'UNKNOWN') {
        return result;
      }
    } catch (e: any) {
      console.warn(`[RuleEngine] Validator ${validator.constructor.name} failed: ${e.message || e}`);
    }
  }

  return {
    status: 'UNKNOWN',
    reasoning: 'No deterministic rules matched. Deferring to AI validation.'
  };
}

// AI Validation Layer using OpenRouter DeepSeek (with Gemini fallback)
async function runAiValidation(
  stepAction: string,
  expectedResult: string,
  evidence: ValidationEvidence,
  screenshotPath?: string
): Promise<{ status: 'Passed' | 'Failed' | 'Blocked'; reasoning: string; confidence: number }> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      return {
        status: 'Blocked',
        reasoning: 'AI Validation Service Unavailable: No OpenRouter, DeepSeek or Gemini API Keys configured in server environment variables.',
        confidence: 0
      };
    }

    let modelInstance;
    let fallbackModelInstance;

    if (process.env.OPENROUTER_API_KEY) {
      const provider = createOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1'
      });
      modelInstance = provider('deepseek/deepseek-chat');

      if (process.env.GEMINI_API_KEY) {
        const geminiProvider = createGoogleGenerativeAI({
          apiKey: process.env.GEMINI_API_KEY
        });
        fallbackModelInstance = geminiProvider('gemini-1.5-flash');
      }
    } else if (process.env.DEEPSEEK_API_KEY) {
      const provider = createOpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com'
      });
      modelInstance = provider('deepseek-chat');
    } else {
      const provider = createGoogleGenerativeAI({
        apiKey: process.env.GEMINI_API_KEY || ''
      });
      modelInstance = provider('gemini-1.5-flash');
    }

    // Build structured evidence context prompt (excluding bodyText to keep prompt tokens clean)
    const cleanEvidence = { ...evidence };
    delete (cleanEvidence as any).bodyText;

    const basePrompt = `
You are a senior QA engineering validator evaluating test execution outcomes.
Compare Expected vs Observed browser states.

Step Action: "${stepAction}"
Expected Result: "${expectedResult}"

Page Evidence Context JSON:
${JSON.stringify(cleanEvidence, null, 2)}

Strict Validation Rules:
1. For authentication error checks, be extremely strict. Expected message 'Username is required' is NOT met if the page shows 'Password is required' or redirect successfully. Wordings may differ slightly but the core error condition must match.
2. If expected result is dashboard navigation redirection, verify redirection path in URL, removal of login form fields, and logout controls.

Your response MUST match this JSON schema:
{
  "status": "Passed" | "Failed",
  "reasoning": "Output structured comparison: expected vs observed, root cause of mismatch, and recommendation.",
  "confidence": 0.0 to 1.0
}
`;

    // Stage 1: Structured JSON only (no screenshots)
    const runCall = async (model: any, withImage = false): Promise<any> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
      try {
        let options: any = {
          model,
          schema: z.object({
            status: z.enum(['Passed', 'Failed']),
            reasoning: z.string(),
            confidence: z.number().min(0).max(1)
          }),
          system: "You are a senior QA engineering validator who evaluates test execution step outcomes.",
          abortSignal: controller.signal
        };

        if (withImage && screenshotPath && fs.existsSync(screenshotPath)) {
          options.messages = [
            {
              role: 'user',
              content: [
                { type: 'text', text: basePrompt },
                { type: 'image', image: fs.readFileSync(screenshotPath) }
              ]
            }
          ];
        } else {
          options.prompt = basePrompt;
        }

        const { object } = await generateObject(options);
        clearTimeout(timeoutId);
        return object;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    };

    let result;
    try {
      result = await runCall(modelInstance, false);
    } catch (e: any) {
      if (fallbackModelInstance) {
        console.warn(`Primary model call failed: ${e.message}. Attempting Gemini fallback...`);
        result = await runCall(fallbackModelInstance, false);
      } else {
        throw e;
      }
    }

    // Stage 2: Multimodal Fallback if confidence < 90%
    if (result.confidence < 0.90 && screenshotPath && fs.existsSync(screenshotPath)) {
      console.log(`[AI-Debug] Confidence below 90% (${result.confidence}). Invoking Stage 2 multimodal validation...`);
      try {
        const visualResult = await runCall(modelInstance, true);
        if (visualResult && visualResult.confidence >= result.confidence) {
          result = visualResult;
        }
      } catch (err: any) {
        console.warn(`Stage 2 multimodal fallback failed: ${err.message}`);
      }
    }

    return {
      status: result.status === 'Passed' ? 'Passed' : 'Failed',
      reasoning: result.reasoning,
      confidence: result.confidence
    };

  } catch (error: any) {
    console.error('Validation error:', error);
    // Classify authentication/credentials and service rate limit errors as service failures
    const isServiceFailure = 
      error.message?.toLowerCase().includes('authentication') ||
      error.message?.toLowerCase().includes('api key') ||
      error.message?.toLowerCase().includes('credentials') ||
      error.message?.toLowerCase().includes('rate limit') ||
      error.message?.toLowerCase().includes('aborted');

    if (isServiceFailure) {
      return {
        status: 'Blocked',
        reasoning: `AI Validation Service Unavailable: ${error.message || error}`,
        confidence: 0
      };
    }

    return {
      status: 'Failed',
      reasoning: `Validation Error: ${error.message || error}`,
      confidence: 0.5
    };
  }
}

async function getOrCreateDummyTestCaseVersionId(projectId: string, userId: string): Promise<string> {
  console.log(`[DB-Debug] getOrCreateDummyTestCaseVersionId called for project: ${projectId}, user: ${userId}`);

  // 1. Get or create dummy TestScenario
  let scenario = await prisma.testScenario.findFirst({
    where: { projectId, scenarioCode: 'AI-EXEC-DUMMY' }
  });
  if (!scenario) {
    console.log(`[DB-Debug] Creating dummy TestScenario...`);
    scenario = await prisma.testScenario.create({
      data: {
        projectId,
        scenarioCode: 'AI-EXEC-DUMMY'
      }
    });
  }
  console.log(`[DB-Debug] TestScenario resolved: ${scenario.id}`);

  // 2. Get or create dummy TestScenarioVersion
  let scenarioVersion = await prisma.testScenarioVersion.findFirst({
    where: { scenarioId: scenario.id }
  });
  if (!scenarioVersion) {
    console.log(`[DB-Debug] Creating dummy TestScenarioVersion...`);
    scenarioVersion = await prisma.testScenarioVersion.create({
      data: {
        scenarioId: scenario.id,
        versionNumber: 1,
        title: 'Dummy Scenario for Execution',
        description: 'Auto-generated for validation reports.',
        uploadedById: userId
      }
    });
  }
  console.log(`[DB-Debug] TestScenarioVersion resolved: ${scenarioVersion.id}`);

  // 3. Get or create dummy TestCase
  let testCase = await prisma.testCase.findFirst({
    where: { projectId, testCaseCode: 'AI-EXEC-DUMMY' }
  });
  if (!testCase) {
    console.log(`[DB-Debug] Creating dummy TestCase...`);
    testCase = await prisma.testCase.create({
      data: {
        projectId,
        testCaseCode: 'AI-EXEC-DUMMY'
      }
    });
  }
  console.log(`[DB-Debug] TestCase resolved: ${testCase.id}`);

  // 4. Get or create dummy TestCaseVersion
  let testCaseVersion = await prisma.testCaseVersion.findFirst({
    where: { testCaseId: testCase.id }
  });
  if (!testCaseVersion) {
    console.log(`[DB-Debug] Creating dummy TestCaseVersion...`);
    testCaseVersion = await prisma.testCaseVersion.create({
      data: {
        testCaseId: testCase.id,
        scenarioVersionId: scenarioVersion.id,
        versionNumber: 1,
        title: 'Dummy Case for Execution',
        priority: 'MEDIUM',
        severity: 'MAJOR',
        automationStatus: 'AUTOMATED',
        uploadedById: userId
      }
    });
  }
  console.log(`[DB-Debug] TestCaseVersion resolved: ${testCaseVersion.id}`);

  // Verify existency in database
  const verification = await prisma.testCaseVersion.findUnique({
    where: { id: testCaseVersion.id }
  });
  if (!verification) {
    throw new Error(`Critical DB verification failed: TestCaseVersion ID ${testCaseVersion.id} was created/found but could not be queried back from DB!`);
  }

  console.log(`[DB-Debug] TestCaseVersion fully verified in DB: ${verification.id}`);
  return testCaseVersion.id;
}

// Pause handler helper
async function checkPauseState(runId: string) {
  while (true) {
    const job = queueManager.getJob(runId);
    if (!job) break;
    if (job.status === 'Cancelled') {
      throw new Error('CANCELLED');
    }
    if (job.status !== 'Paused') {
      break;
    }
    // Wait 1s and check status again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

export async function executeTestRun(job: ExecutionJob) {
  const { runId, projectId, testCaseIds, websiteUrl, browser: browserType } = job;
  ensureDirectories();

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  const consoleLogs: string[] = [];
  const networkLogs: string[] = [];
  const networkResponseStatusMap: Record<string, number> = {};
  const responseBodies: Record<string, string> = {};

  // Create db run entry
  let dbRun = await prisma.testRun.create({
    data: {
      id: runId,
      projectId,
      name: `AI Run - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      status: 'RUNNING',
      startedAt: new Date()
    }
  });

  try {
    // 1. Fetch Project & Filter Selected Test Cases
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || !project.testCases) {
      throw new Error(`Project or test cases not found in database.`);
    }

    const testCasesSource = (project.testCases as any).test_cases || [];
    const selectedTestCases = testCasesSource.filter((tc: any) => testCaseIds.includes(tc.test_case_id));

    if (selectedTestCases.length === 0) {
      throw new Error(`No valid matching test cases found to execute.`);
    }

    // 2. Launch Browser
    queueManager.addLog(runId, `Launching browser ${browserType} in headless mode...`);
    try {
      const launchOptions = { headless: true };
      if (browserType === 'chromium') {
        browser = await chromium.launch(launchOptions);
      } else if (browserType === 'firefox') {
        browser = await firefox.launch(launchOptions);
      } else if (browserType === 'webkit') {
        browser = await webkit.launch(launchOptions);
      } else {
        browser = await chromium.launch(launchOptions); // default
      }
    } catch (e: any) {
      throw new Error(`Playwright browser binaries not installed. Details: ${e.message || e}`);
    }

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } }
    });

    // Start tracing
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true }).catch(() => {});

    page = await context.newPage();

    // Attach Loggers
    page.on('console', msg => {
      const log = `[Console ${msg.type()}] ${msg.text()}`;
      consoleLogs.push(log);
      queueManager.addLog(runId, log);
    });

    page.on('requestfailed', req => {
      const err = `[Network Fail] ${req.method()} ${req.url()}: ${req.failure()?.errorText}`;
      networkLogs.push(err);
      queueManager.addLog(runId, err);
    });

    page.on('response', async res => {
      const key = `${res.request().method()} ${res.url()}`;
      networkResponseStatusMap[key] = res.status();
      try {
        const contentType = res.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const body = await res.text();
          if (body) responseBodies[key] = body;
        }
      } catch (e) {}
      if (res.status() >= 400) {
        const err = `[HTTP Error ${res.status()}] ${res.request().method()} ${res.url()}`;
        networkLogs.push(err);
        queueManager.addLog(runId, err);
      }
    });

    // Determine total steps
    let totalSteps = 0;
    selectedTestCases.forEach((tc: any) => {
      const steps = tc.steps ? tc.steps.split('\n') : [];
      totalSteps += steps.length;
    });

    queueManager.updateJobProgress(runId, 0, totalSteps);
    let completedStepsCount = 0;
    let passedTestCasesCount = 0;

    const runStartTime = Date.now();

    // 3. Loop through test cases
    for (const tc of selectedTestCases) {
      await checkPauseState(runId);
      
      const tcStartTime = Date.now();
      queueManager.addLog(runId, `======================================`);
      queueManager.addLog(runId, `🚀 Starting Test Case: ${tc.test_case_id} - ${tc.summary || tc.title}`);
      
      // Get valid testCaseVersionId pointing to a real DB record (satisfies foreign key constraints)
      const dummyVersionId = await getOrCreateDummyTestCaseVersionId(projectId, project.userId);
      console.log(`[Executor] Using verified dummyVersionId: ${dummyVersionId}`);

      // Create Database TestExecution
      const dbExecution = await prisma.testExecution.create({
        data: {
          runId,
          testCaseVersionId: dummyVersionId,
          status: 'PENDING',
          startedAt: new Date(),
        }
      });

      const rawSteps = tc.steps ? tc.steps.split('\n').filter((s: string) => s.trim().length > 0) : [];
      let allStepsPassed = true;
      let tcFinalStatus: 'PASSED' | 'FAILED' | 'BLOCKED' = 'PASSED';
      let tcFailureReason = '';
      let tcConfidenceSum = 0;

      // Navigate to website URL first
      try {
        await performActionWithRetry(page, 'navigate', websiteUrl);
        queueManager.addLog(runId, `Navigated to target URL: ${websiteUrl}`);
      } catch (e: any) {
        allStepsPassed = false;
        tcFailureReason = `Failed to navigate to target URL: ${e.message}`;
        queueManager.addLog(runId, `[Error] ${tcFailureReason}`);
      }

      // 4. Loop steps in test case
      if (allStepsPassed) {
        for (let idx = 0; idx < rawSteps.length; idx++) {
          await checkPauseState(runId);

          const stepNum = idx + 1;
          const stepText = rawSteps[idx].replace(/^\d+[\.\s\-]+/, '').trim(); // clean step prefix number
          const expected = tc.expected_result || '';
          
          queueManager.addLog(runId, `--------------------------------------`);
          queueManager.addLog(runId, `Running Step ${stepNum}: ${stepText}`);

          const dbStep = await prisma.executionStep.create({
            data: {
              executionId: dbExecution.id,
              stepNumber: stepNum,
              status: 'PENDING'
            }
          });

          const stepStartTime = Date.now();
          let statusMapping: 'PASSED' | 'FAILED' | 'BLOCKED' = 'PASSED';
          let stepActual = '';
          let stepExpectedResult = '';

          try {
            // Split step by sub-step numbers if they are combined on one line: e.g. "1. Navigate ... 2. Enter ..."
            let subSteps = [stepText];
            if (stepText.match(/\d+[\.\s\-]+\w+/)) {
              subSteps = stepText
                .split(/(?=\d+[\.\s\-]+)/)
                .map((s: string) => s.replace(/^\d+[\.\s\-]+/, '').trim())
                .filter((s: string) => s.length > 0);
            }

            // Expand "Enter valid credentials" into Username & Password entry steps dynamically
            let expandedSubSteps: string[] = [];
            for (const subStep of subSteps) {
              const lowerSub = subStep.toLowerCase();
              if (lowerSub.includes('enter valid credentials') || lowerSub.includes('enter credentials') || lowerSub.includes('valid credentials')) {
                expandedSubSteps.push('Enter valid username');
                expandedSubSteps.push('Enter valid password');
              } else {
                expandedSubSteps.push(subStep);
              }
            }
            subSteps = expandedSubSteps;

            queueManager.addLog(runId, `Executing ${subSteps.length} sub-actions for step...`);

            // Run each sub-action sequentially
            for (let subIdx = 0; subIdx < subSteps.length; subIdx++) {
              const subStep = subSteps[subIdx];
              const parsed = parseSubAction(subStep, websiteUrl);
              
              queueManager.addLog(runId, `Sub-action ${subIdx + 1}: [${parsed.actionType}] matching target "${parsed.target}" with value "${parsed.value}"`);
              
              await performActionWithRetry(page, parsed.actionType, parsed.target, parsed.value);
              await page.waitForTimeout(1000); // stable wait
            }

            // 1. Gather page evidence
            const evidence = await collectEvidence(page, consoleLogs, networkLogs, networkResponseStatusMap, responseBodies);

            const isLastStep = (idx === rawSteps.length - 1);
            stepExpectedResult = isLastStep ? expected : `The step action "${stepText}" completes successfully without error.`;

            // Parse last sub-action for rule matching
            const lastSubStep = subSteps[subSteps.length - 1];
            const parsedAction = parseSubAction(lastSubStep, websiteUrl);

            // 2. Invoke Pluggable Rule Engine
            queueManager.addLog(runId, `Applying Deterministic Rule Engine...`);
            const ruleResult = await runRuleEngine(page, stepText, stepExpectedResult, parsedAction, evidence);

            statusMapping = 'PASSED';
            stepActual = '';
            let confidence = 1.0;

            if (ruleResult.status !== 'UNKNOWN') {
              queueManager.addLog(runId, `Rule Engine Decision: [${ruleResult.status}]`);
              queueManager.addLog(runId, `Rule Engine Reasoning: ${ruleResult.reasoning}`);
              
              statusMapping = ruleResult.status === 'PASS' ? 'PASSED' : 'FAILED';
              
              // Structure rule outcome
              stepActual = `### Expected\n${stepExpectedResult}\n\n### Observed\n${ruleResult.reasoning}\n\n### Evidence\n- **Rule Engine**: Deterministic match.\n- **Action Type**: ${parsedAction.actionType}\n- **Target URL**: ${evidence.url}`;
              confidence = 1.0;
            } else {
              // 3. Fallback to AI semantic validation
              queueManager.addLog(runId, `Rule Engine returned UNKNOWN. Invoking Stage 1 Text AI validation...`);
              
              // Pre-take screenshot path for Stage 2 multimodal fallback if confidence < 90%
              const screenshotFilename = `${runId}-${tc.test_case_id}-step-${stepNum}.png`;
              const screenshotPath = path.join(SCREENSHOT_DIR, screenshotFilename);
              try {
                await page.screenshot({ path: screenshotPath });
              } catch (e) {}

              const aiResult = await runAiValidation(stepText, stepExpectedResult, evidence, screenshotPath);
              confidence = aiResult.confidence;
              
              // Map AI status with confidence boundaries
              if (aiResult.status === 'Blocked') {
                statusMapping = 'BLOCKED';
                stepActual = `### Status: AI_UNAVAILABLE / BLOCKED\n\n### Reasoning\n${aiResult.reasoning}`;
              } else if (aiResult.status === 'Passed') {
                if (confidence >= 0.95) {
                  statusMapping = 'PASSED';
                  stepActual = `### Expected\n${stepExpectedResult}\n\n### Observed\n${aiResult.reasoning}\n\n### AI Confidence\n${Math.round(confidence * 100)}%`;
                } else if (confidence >= 0.90) {
                  // WARNING / Needs Review
                  statusMapping = 'PASSED'; // Map to PASSED so test run doesn't fail, but explain WARNING state
                  stepActual = `### Status: WARNING / Needs Review\n\n### Expected\n${stepExpectedResult}\n\n### Observed\n${aiResult.reasoning}\n\n### AI Confidence\n${Math.round(confidence * 100)}%`;
                } else {
                  // confidence < 90% -> Manual Review (BLOCKED)
                  statusMapping = 'BLOCKED';
                  stepActual = `### Status: BLOCKED / Manual Review Required (Confidence < 90%)\n\n### Expected\n${stepExpectedResult}\n\n### Observed\n${aiResult.reasoning}\n\n### AI Confidence\n${Math.round(confidence * 100)}%`;
                }
              } else {
                statusMapping = 'FAILED';
                stepActual = `### Expected\n${stepExpectedResult}\n\n### Observed\n${aiResult.reasoning}\n\n### AI Confidence\n${Math.round(confidence * 100)}%`;
              }

              queueManager.addLog(runId, `AI Decision: [${statusMapping}] | Confidence: ${confidence}`);
            }

            tcConfidenceSum += confidence;

          } catch (e: any) {
            statusMapping = 'FAILED';
            const msg = e.message?.toLowerCase() || '';
            let classification = 'SYSTEM_ERROR';

            if (msg.includes('locate') || msg.includes('selector') || msg.includes('element')) {
              classification = 'LOCATOR_FAILURE';
            } else if (msg.includes('timeout') || msg.includes('timed out')) {
              classification = 'TIMEOUT';
            } else if (msg.includes('network') || msg.includes('cors') || msg.includes('fetch')) {
              classification = 'NETWORK_FAILURE';
            } else if (msg.includes('credentials') || msg.includes('match') || msg.includes('sadface')) {
              classification = 'TEST_DATA_FAILURE';
            } else if (msg.includes('assertion') || msg.includes('expect')) {
              classification = 'ASSERTION_FAILURE';
            } else if (msg.includes('500') || msg.includes('server error') || msg.includes('internal')) {
              classification = 'APPLICATION_FAILURE';
            } else {
              classification = 'ENVIRONMENT_FAILURE';
            }

            stepActual = `### Status: ${classification}\n\n### Expected\n${stepExpectedResult || 'Verify action completes.'}\n\n### Observed\n${e.message}\n\n### Recommendation\nVerify selectors, server status, or page state.`;
            queueManager.addLog(runId, `[Error] ${classification}: ${e.message}`);
          }

          // Take Step Screenshot (if not taken already)
          const screenshotFilename = `${runId}-${tc.test_case_id}-step-${stepNum}.png`;
          const screenshotPath = path.join(SCREENSHOT_DIR, screenshotFilename);
          if (!fs.existsSync(screenshotPath)) {
            try {
              await page.screenshot({ path: screenshotPath });
              queueManager.addLog(runId, `Screenshot saved to disk: ${screenshotFilename}`);
            } catch (e) {
              queueManager.addLog(runId, `[Warning] Failed to capture step screenshot`);
            }
          }

          // Update DB Step
          await prisma.executionStep.update({
            where: { id: dbStep.id },
            data: {
              status: statusMapping,
              actualResult: stepActual
            }
          });

          // Create attachment record
          await prisma.attachment.create({
            data: {
              fileName: screenshotFilename,
              fileSize: fs.existsSync(screenshotPath) ? fs.statSync(screenshotPath).size : 0,
              mimeType: 'image/png',
              fileUrl: `/storage/test-runs/screenshots/${screenshotFilename}`,
              uploadedById: project.userId,
              executionId: dbExecution.id
            }
          });

          completedStepsCount++;
          queueManager.updateJobProgress(runId, completedStepsCount, totalSteps);

          if (statusMapping === 'FAILED' || statusMapping === 'BLOCKED') {
            allStepsPassed = false;
            tcFinalStatus = statusMapping;
            tcFailureReason = stepActual;
            break; // Stop executing further steps in this test case
          }
        }
      }

      // Save execution duration
      const tcDuration = Date.now() - tcStartTime;

      // Update Database TestExecution status
      const finalStatus = allStepsPassed ? 'PASSED' : tcFinalStatus;
      if (allStepsPassed) passedTestCasesCount++;

      await prisma.testExecution.update({
        where: { id: dbExecution.id },
        data: {
          status: finalStatus,
          actualResult: allStepsPassed ? 'All steps completed successfully.' : tcFailureReason,
          executionTimeMs: tcDuration,
          completedAt: new Date()
        }
      });

      queueManager.addLog(runId, `Finished Test Case. Status: [${finalStatus}]`);
    }

    // Stop Playwright Tracing if context exists
    if (context) {
      const traceFilename = `${runId}-trace.zip`;
      const tracePath = path.join(LOG_DIR, traceFilename);
      await context.tracing.stop({ path: tracePath }).catch(() => {});
      queueManager.addLog(runId, `Trace file saved: ${traceFilename}`);
    }

    // 5. Complete Database run metrics
    const totalDuration = Date.now() - runStartTime;
    const finalRunStatus = passedTestCasesCount === selectedTestCases.length ? 'COMPLETED' : 'COMPLETED';

    await prisma.testRun.update({
      where: { id: runId },
      data: {
        status: finalRunStatus,
        completedAt: new Date()
      }
    });

    await prisma.executionMetrics.create({
      data: {
        runId,
        totalTests: selectedTestCases.length,
        passedCount: passedTestCasesCount,
        failedCount: selectedTestCases.length - passedTestCasesCount,
        blockedCount: 0,
        skippedCount: 0,
        totalDurationMs: totalDuration,
        passRatePercentage: (passedTestCasesCount / selectedTestCases.length) * 100
      }
    });

    // Write log history to a file
    const logFilename = `${runId}-execution-logs.txt`;
    const logPath = path.join(LOG_DIR, logFilename);
    fs.writeFileSync(logPath, job.progressLogs.join('\n'));

    queueManager.addLog(runId, `======================================`);
    queueManager.addLog(runId, `🎉 Test Run Completed Successfully! Log file saved.`);
    queueManager.updateJobStatus(runId, 'Completed');

  } catch (err: any) {
    const isCancelled = err.message === 'CANCELLED';
    const statusText: RunControlState = isCancelled ? 'Cancelled' : 'Completed';
    queueManager.addLog(runId, `[System Alert] Worker loop interrupted: ${err.message || err}`);
    
    // Update DB TestRun status
    await prisma.testRun.update({
      where: { id: runId },
      data: {
        status: isCancelled ? 'PENDING' : 'COMPLETED', // will show cancelled/terminated
        completedAt: new Date()
      }
    });

    queueManager.updateJobStatus(runId, statusText);
  } finally {
    // Graceful cleanups
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}
