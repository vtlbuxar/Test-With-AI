import { NextResponse } from 'next/server';
import { z } from 'zod';
import { extractTextFromRequest } from '@/lib/file-parser';
import { generateEnsembleObject } from '@/lib/ensemble';

export async function POST(req: Request) {
  try {
    const geminiKey = req.headers.get('x-gemini-api-key') || undefined;
    const { platform, text: requirementText } = await extractTextFromRequest(req);

    const TestCaseSchema = z.object({
      test_case_id: z.string(),
      type: z.string(),
      summary: z.string(),
      steps: z.string(),
      expected_result: z.string(),
      priority: z.string(),
      title: z.string().optional(),
      justification: z.string().describe("Why this belongs in this suite"),
      risk_level: z.enum(["High", "Medium", "Low"]).describe("Risk level based on business impact and failure probability"),
      risk_justification: z.string().describe("Why this risk level was assigned")
    });

    const object = await generateEnsembleObject({
      apiKeys: { gemini: geminiKey },
      schema: z.object({
        smoke_tests: z.array(TestCaseSchema),
        regression_tests: z.array(TestCaseSchema)
      }),
      prompt: `
        Analyze the following requirement for a ${platform} application.
        Identify and categorize test cases into two specific test suites:
        1. Smoke Tests: Critical path and basic functionality tests that must pass to consider a build testable.
        2. Regression Tests: Comprehensive tests to ensure existing functionality continues to work.

        For each test, provide full detailed test case properties (ID, type, summary, steps, expected result, priority, justification, risk level, and risk justification).
        
        Requirement:
        ${requirementText}
      `,
      systemInstruction: "You are an expert Test Manager identifying crucial test suites."
    });

    return NextResponse.json(object);
  } catch (error: any) {
    console.error('Error generating suites:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
