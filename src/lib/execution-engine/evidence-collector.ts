import { Page } from 'playwright';
import { ValidationEvidence } from './validators/BaseValidator';

export async function collectEvidence(
  page: Page,
  consoleLogs: string[],
  networkLogs: string[],
  networkResponseStatusMap: Record<string, number> = {},
  responseBodies: Record<string, string> = {}
): Promise<ValidationEvidence> {
  const url = page.url();
  const title = await page.title().catch(() => '');
  const cookies = await page.context().cookies().catch(() => []);
  
  // Extract inputs value state
  const inputs = await page.evaluate(() => {
    const data: Record<string, string> = {};
    const inputElements = document.querySelectorAll('input, textarea, select');
    inputElements.forEach((el: any) => {
      const key = el.id || el.name || el.placeholder || el.tagName.toLowerCase();
      if (key) {
        if (el.type === 'checkbox' || el.type === 'radio') {
          data[key] = el.checked ? 'true' : 'false';
        } else {
          data[key] = el.value || '';
        }
      }
    });
    return data;
  }).catch(() => ({}));

  // ARIA tree extraction
  const ariaTree = await page.evaluate(() => {
    const list: string[] = [];
    const elements = document.querySelectorAll('[role], button, input, a, select, h1, h2, h3');
    elements.forEach((el: any) => {
      const role = el.getAttribute('role') || el.tagName.toLowerCase();
      const label = el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || '';
      const cleanLabel = label.trim().slice(0, 50).replace(/\n/g, ' ');
      if (role && cleanLabel) {
        list.push(`- Role: ${role} | Label: "${cleanLabel}"`);
      }
    });
    return list.join('\n');
  }).catch(() => '');

  // Visible vs Hidden elements lists
  const elementVisibility = await page.evaluate(() => {
    const visible: string[] = [];
    const hidden: string[] = [];
    const query = document.querySelectorAll('button, a, input, select');
    query.forEach((el: any) => {
      const isVisible = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const identifier = el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : el.tagName.toLowerCase();
      if (isVisible) {
        visible.push(identifier);
      } else {
        hidden.push(identifier);
      }
    });
    return { visible, hidden };
  }).catch(() => ({ visible: [], hidden: [] }));

  // Currently focused element
  const focusedElementSelector = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body) return null;
    return active.id ? `#${active.id}` : active.tagName.toLowerCase();
  }).catch(() => null);

  // Visible body text content
  const bodyText = await page.evaluate(() => document.body.innerText || '').catch(() => '');

  // Scrape list of all buttons
  const buttons = await page.evaluate(() => {
    const elements = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
    return Array.from(elements).map((el: any) => el.id || el.name || el.innerText || el.value || 'button').filter(Boolean);
  }).catch(() => []);

  // Scrape list of all links
  const links = await page.evaluate(() => {
    const elements = document.querySelectorAll('a');
    return Array.from(elements).map((el: any) => el.href).filter(Boolean);
  }).catch(() => []);

  // Scrape list of disabled elements
  const disabledElements = await page.evaluate(() => {
    const elements = document.querySelectorAll('[disabled]');
    return Array.from(elements).map((el: any) => el.id || el.name || el.tagName.toLowerCase()).filter(Boolean);
  }).catch(() => []);

  // Scrape all current form values
  const formValues = { ...inputs };

  return {
    url,
    title,
    cookies,
    consoleLogs,
    networkLogs,
    focusedElementSelector,
    inputs,
    visibleElements: elementVisibility.visible,
    hiddenElements: elementVisibility.hidden,
    ariaTree,
    bodyText,
    httpStatus: 200, // default fallback
    buttons,
    links,
    disabledElements,
    formValues,
    networkResponseStatusMap,
    responseBodies
  };
}
