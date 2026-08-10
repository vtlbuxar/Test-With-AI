import mammoth from 'mammoth';
import * as xlsx from 'xlsx';

// Polyfill DOMMatrix for pdf-parse in older Node environments
if (typeof global !== 'undefined' && typeof (global as any).DOMMatrix === 'undefined') {
  (global as any).DOMMatrix = class DOMMatrix {
    constructor() {}
  };
}

export async function parseFileToText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.pdf')) {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(arrayBuffer) });
    try {
      const data = await parser.getText();
      return data.text;
    } finally {
      // PDFParse currently doesn't have an async destroy method in this version, so no-op or just leave try-finally
    }
  } else if (fileName.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.csv')) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    return xlsx.utils.sheet_to_csv(worksheet);
  } else {
    throw new Error('Unsupported file type. Please upload PDF, DOCX, XLSX, or CSV.');
  }
}

export async function extractTextFromFormData(formData: FormData): Promise<{ platform: string, text: string }> {
  const platform = formData.get('platform') as string || 'Web App';
  const requirement = formData.get('requirement') as string | null;
  const file = formData.get('file') as File | null;

  let extractedText = '';

  if (file) {
    extractedText = await parseFileToText(file);
  } else if (requirement) {
    extractedText = requirement;
  }

  if (!extractedText || !extractedText.trim()) {
    throw new Error('Requirement text or file is required.');
  }

  // Truncate text to roughly 40,000 characters (~10k tokens) to prevent exceeding free tier API rate limits
  if (extractedText.length > 40000) {
    extractedText = extractedText.substring(0, 40000) + "\n\n...[DOCUMENT TRUNCATED DUE TO API LIMITS]...";
  }

  return { platform, text: extractedText };
}

export async function extractTextFromRequest(req: Request): Promise<{ platform: string, text: string }> {
  const formData = await req.formData();
  return extractTextFromFormData(formData);
}
