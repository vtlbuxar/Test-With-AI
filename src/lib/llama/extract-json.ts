/**
 * Robustly extracts JSON text from raw LLM responses.
 * Handles markdown code blocks, conversational preambles/suffixes, extra whitespace,
 * multiple code blocks, and malformed text prefixes.
 */
export function extractJson(rawText: string): { jsonText: string; extracted: boolean } {
  if (!rawText || typeof rawText !== 'string') {
    return { jsonText: '', extracted: false };
  }

  let text = rawText.trim();
  let extracted = false;

  // 1. Try matching explicit markdown code blocks ```json ... ``` or ``` ... ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  const matches = [...text.matchAll(codeBlockRegex)];

  if (matches.length > 0) {
    // Pick the first code block that contains JSON braces/brackets
    for (const match of matches) {
      const content = match[1].trim();
      if (content.startsWith('{') || content.startsWith('[')) {
        text = content;
        extracted = true;
        break;
      }
    }
  }

  // 2. If no valid code block was found, search for the outer structural JSON boundaries
  if (!extracted) {
    const firstBrace = text.search(/[\{\[]/);
    const lastBrace = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1).trim();
      extracted = true;
    }
  }

  return {
    jsonText: text,
    extracted,
  };
}
