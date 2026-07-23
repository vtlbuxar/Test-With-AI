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
    const formData = await req.formData();
    const testCaseStr = formData.get('testCase') as string;
    const testCase = JSON.parse(testCaseStr);
    const { platform, text: requirement } = await extractTextFromFormData(formData);

    const { result, summary } = await generateEnsembleObject({
      aiConfig,
      schema: z.object({
        possible_bugs: z.array(z.string()).describe("List of potential logical or functional bugs"),
        security_bugs: z.array(z.string()).describe("List of potential security vulnerabilities"),
        validation_bugs: z.array(z.string()).describe("List of potential input validation bypasses or errors"),
        edge_cases: z.array(z.string()).describe("List of edge cases that might cause failure")
      }),
      prompt: `
        Analyze the following requirement and test case.
        Generate a comprehensive list of potential defects, bugs, and edge cases that a developer might introduce or that QA should look out for when executing this test.
        
        Requirement:
        ${requirement}

        Test Case ID: ${testCase.test_case_id}
        Test Case Summary: ${testCase.summary}
        Test Case Steps: ${testCase.steps}
      `,
      systemInstruction: "You are an expert QA Engineer and Security Analyst deeply skilled in finding edge cases and predicting software bugs."
    });

    return NextResponse.json(result, {
      headers: {
        'X-Model-Used': summary.model,
        'X-Generation-Summary': encodeURIComponent(JSON.stringify(summary))
      }
    });
  } catch (error) {
    console.error('Error generating defects:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate defects' }, { status: 500 });
  }
}
