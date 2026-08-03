import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { extractTextFromFormData } from '@/lib/file-parser';
import { generateEnsembleObject, parseAIConfig } from '@/lib/ensemble';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const geminiKey = req.headers.get('x-gemini-api-key') || undefined;
    const aiConfigHeader = req.headers.get('x-ai-config');
    const aiConfig = parseAIConfig(aiConfigHeader, geminiKey);
    
    // Check Freemium Quota
    const { checkAndIncrementQuota } = await import('@/lib/quota');
    const quota = await checkAndIncrementQuota(aiConfig);
    if (!quota.allowed) {
      return NextResponse.json({ error: quota.error }, { status: 403 });
    }

    const formData = await req.formData();
    const testCaseStr = formData.get('testCase') as string;
    const testCase = JSON.parse(testCaseStr);
    const { platform, text: requirement } = await extractTextFromFormData(formData);

    const { result, summary } = await generateEnsembleObject({
      aiConfig,
      requestType: '/api/generate-test-data',
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

    return NextResponse.json(result, {
      headers: {
        'X-Model-Used': summary.model,
        'X-Generation-Summary': encodeURIComponent(JSON.stringify(summary))
      }
    });
  } catch (error) {
    console.error('Error generating test data:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate test data' }, { status: 500 });
  }
}
