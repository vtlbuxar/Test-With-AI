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
        test_scenarios: z.array(
          z.object({
            scenario_id: z.string(),
            category: z.enum(["Positive/Happy Path", "Negative/Exception Path", "Boundary/Edge Cases"]),
            description: z.string().describe("High-level description of what is being tested.")
          })
        )
      }),
      prompt: `Platform Context: ${platform}\n\nRequirement:\n${text}`,
      systemInstruction: `You are an expert Principal QA Engineer and Test Analyst. Your objective is to read software requirements and generate comprehensive, 360-degree test scenarios.
Develop high-level test scenarios. A scenario describes what to test, not how. Categories must be:
- Positive/Happy Path
- Negative/Exception Path
- Boundary/Edge Cases`
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error('Error generating scenarios:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate scenarios' }, { status: 500 });
  }
}
