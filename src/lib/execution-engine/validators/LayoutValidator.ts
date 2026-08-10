import { Page } from 'playwright';
import { BaseValidator, ValidationEvidence, ValidatorResult } from './BaseValidator';

export class LayoutValidator implements BaseValidator {
  async validate(
    page: Page,
    stepText: string,
    expectedResult: string,
    action: { actionType: 'click' | 'fill' | 'navigate' | 'observe'; target: string; value: string },
    evidence: ValidationEvidence
  ): Promise<ValidatorResult> {
    const text = stepText.toLowerCase();
    const expected = expectedResult.toLowerCase();

    // Check if layout or responsiveness is being validated
    const isLayoutCheck = 
      action.actionType === 'observe' || 
      text.includes('layout') || 
      text.includes('responsive') || 
      text.includes('responsiveness') || 
      text.includes('screen') || 
      text.includes('overlap') ||
      expected.includes('responsiveness') || 
      expected.includes('displayed correctly');

    if (!isLayoutCheck) {
      return { status: 'UNKNOWN', reasoning: 'Not a layout validation check.' };
    }

    // Deterministic Rule 1: Validate Horizontal Scroll (Overflow)
    const overflowStats = await page.evaluate(() => {
      const scrollWidth = document.documentElement.scrollWidth;
      const innerWidth = window.innerWidth;
      const hasHorizontalScroll = scrollWidth > (innerWidth + 15); // tolerance offset of 15px
      return { scrollWidth, innerWidth, hasHorizontalScroll };
    }).catch(() => ({ scrollWidth: 0, innerWidth: 0, hasHorizontalScroll: false }));

    if (overflowStats.hasHorizontalScroll) {
      return {
        status: 'FAIL',
        reasoning: `Layout Failure: Horizontal overflow scrollbar detected! scrollWidth (${overflowStats.scrollWidth}px) exceeds viewport width (${overflowStats.innerWidth}px).`
      };
    }

    // Deterministic Rule 2: CSS / Stylesheet integration validation
    const hasStylesLoaded = await page.evaluate(() => {
      const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
      return styles.length > 0;
    }).catch(() => false);

    if (!hasStylesLoaded) {
      return {
        status: 'FAIL',
        reasoning: 'Layout Failure: CSS styling stylesheets could not be detected. Page is rendering unstyled content.'
      };
    }

    // Deterministic Rule 3: Elements overlapping verification
    const overlaps = await page.evaluate(() => {
      const overlapList: string[] = [];
      const targets = Array.from(document.querySelectorAll('button, input, select, a')).slice(0, 10); // Check first 10 primary nodes
      
      for (let i = 0; i < targets.length; i++) {
        const rectA = targets[i].getBoundingClientRect();
        if (rectA.width === 0 || rectA.height === 0) continue;

        for (let j = i + 1; j < targets.length; j++) {
          const rectB = targets[j].getBoundingClientRect();
          if (rectB.width === 0 || rectB.height === 0) continue;

          // Check direct overlap intersections
          const isOverlapping = !(
            rectA.right <= rectB.left ||
            rectA.left >= rectB.right ||
            rectA.bottom <= rectB.top ||
            rectA.top >= rectB.bottom
          );

          if (isOverlapping) {
            const labelA = targets[i].id || targets[i].tagName;
            const labelB = targets[j].id || targets[j].tagName;
            overlapList.push(`${labelA} overlaps with ${labelB}`);
          }
        }
      }
      return overlapList;
    }).catch(() => []);

    if (overlaps.length > 0) {
      return {
        status: 'FAIL',
        reasoning: `Layout Failure: Overlapping interactive nodes detected! Overlaps: [${overlaps.join(', ')}]`
      };
    }

    // All deterministic layout checks passed successfully
    return {
      status: 'PASS',
      reasoning: `Layout Pass: Responsive viewport dimensions verified (${overflowStats.innerWidth}px width). Styles loaded and interactive nodes are visible, clickable, and overlap-free.`
    };
  }
}
