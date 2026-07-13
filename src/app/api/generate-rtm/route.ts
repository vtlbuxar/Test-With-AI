import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { extractTextFromRequest } from '@/lib/file-parser';
import { generateEnsembleObject } from '@/lib/ensemble';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const geminiKey = req.headers.get('x-gemini-api-key') || undefined;
    const { platform, text } = await extractTextFromRequest(req);

    const object = await generateEnsembleObject({
      apiKeys: { gemini: geminiKey },
      schema: z.object({
        summary: z.string().describe("A brief summary of the document and overall requirements found."),
        rtm: z.array(
          z.object({
            req_id: z.string(),
            type: z.enum(["Functional", "Non-Functional"]),
            description: z.string(),
            testable_items: z.array(z.string())
          })
        )
      }),
      prompt: `Platform Context: ${platform}\n\nAnalyze the following requirement document and generate the RTM:\n\n${text}`,
      systemInstruction: `You are an expert Principal QA Engineer and Test Analyst. Your objective is to read a requirement document and generate a Requirement Traceability Matrix (RTM).

You must categorize requirements into Functional and Non-Functional, and identify the specific testable items for each requirement to ensure 100% test coverage.

Step 1: Requirement Analysis
Extract all distinct requirements from the provided document text.

Step 2: Categorize & Extract Testable Items
For each requirement:
- Assign a unique Requirement ID (e.g., REQ-001, FR-01, NFR-01).
- Classify it as 'Functional' or 'Non-Functional'.
- Provide a brief description of the requirement.
- List all testable items (what exactly needs to be verified to consider this requirement implemented).`
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error('Error generating RTM:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate RTM' }, { status: 500 });
  }
}
