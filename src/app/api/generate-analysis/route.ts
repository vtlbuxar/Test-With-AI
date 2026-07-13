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
        requirement_analysis: z.string().describe("A 3-4 sentence summary of your understanding of the core logic and risks.")
      }),
      prompt: `Platform Context: ${platform}\n\nRequirement:\n${text}`,
      systemInstruction: `You are an expert Principal QA Engineer and Test Analyst. Your objective is to read software requirements and generate a detailed Requirement Analysis.
Analyze the requirement. Identify the primary actors, the core business logic, implicit dependencies, and potential points of failure.
Provide a clear, concise 3-4 sentence summary.`
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error('Error generating analysis:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate analysis' }, { status: 500 });
  }
}
