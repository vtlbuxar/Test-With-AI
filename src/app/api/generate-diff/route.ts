import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateEnsembleObject } from '@/lib/ensemble';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const geminiKey = req.headers.get('x-gemini-api-key') || undefined;
    const body = await req.json();
    const { requirement_v1, requirement_v2 } = body;

    const object = await generateEnsembleObject({
      apiKeys: { gemini: geminiKey },
      schema: z.object({
        added_requirements: z.array(z.string()).describe("New requirements added in v2"),
        removed_requirements: z.array(z.string()).describe("Requirements that were in v1 but removed in v2"),
        modified_requirements: z.array(z.string()).describe("Requirements that were changed"),
        impacted_test_cases: z.array(z.string()).describe("Summary of what types of tests or specific scenarios will be impacted by these changes"),
        regression_scope: z.enum(["High", "Medium", "Low"]).describe("Overall regression risk and scope due to these changes")
      }),
      prompt: `
        Analyze the differences between two versions of a requirement document.
        Identify what was added, removed, and modified. Then, analyze the impact these changes will have on existing test cases and determine the regression scope.
        
        Requirement Version 1:
        ${requirement_v1}

        Requirement Version 2:
        ${requirement_v2}
      `,
      systemInstruction: "You are an expert QA Manager and Business Analyst specializing in Requirement Traceability and Impact Analysis."
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error('Error generating difference analysis:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate diff' }, { status: 500 });
  }
}
