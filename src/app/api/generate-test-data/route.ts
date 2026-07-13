import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { extractTextFromFormData } from '@/lib/file-parser';
import { generateEnsembleObject } from '@/lib/ensemble';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const geminiKey = req.headers.get('x-gemini-api-key') || undefined;
    const formData = await req.formData();
    const testCaseStr = formData.get('testCase') as string;
    const testCase = JSON.parse(testCaseStr);
    const { platform, text: requirement } = await extractTextFromFormData(formData);

    const object = await generateEnsembleObject({
      apiKeys: { gemini: geminiKey },
      schema: z.object({
        positive_data: z.array(z.any()).describe("Valid, expected inputs for the test case"),
        negative_data: z.array(z.any()).describe("Invalid inputs expected to trigger an error"),
        boundary_data: z.array(z.any()).describe("Values at the extreme edges of allowed inputs"),
        security_payloads: z.array(z.string()).describe("SQL injection, XSS, or other malicious strings"),
        edge_case_data: z.array(z.any()).describe("Null values, extremely long strings, emojis, unicode, etc.")
      }),
      prompt: `
        Analyze the following requirement and test case.
        Generate comprehensive sets of Test Data that a QA Engineer would use to execute this test.
        
        Requirement:
        ${requirement}

        Test Case ID: ${testCase.test_case_id}
        Test Case Summary: ${testCase.summary}
        Test Case Steps: ${testCase.steps}
      `,
      systemInstruction: "You are an expert QA Engineer and Data Architect deeply skilled in creating diverse test data covering all edge cases."
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error('Error generating test data:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate test data' }, { status: 500 });
  }
}
