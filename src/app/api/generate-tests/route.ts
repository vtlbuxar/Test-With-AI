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
        test_cases: z.array(
          z.object({
            test_case_id: z.string(),
            type: z.string().describe("e.g., Smoke, Regression, Functional, Security"),
            summary: z.string().describe("A summary of what is being tested"),
            steps: z.string().describe("The step-by-step instructions to reproduce the test case"),
            expected_result: z.string(),
            priority: z.string().describe("e.g., High, Medium, Low"),
            risk_level: z.enum(["High", "Medium", "Low"]).describe("Risk level based on business impact and failure probability"),
            risk_justification: z.string().describe("Why this risk level was assigned")
          })
        ),
        quality_score: z.object({
          overall_score_percentage: z.number().min(0).max(100),
          requirement_coverage_percentage: z.number().min(0).max(100),
          duplicate_count: z.number(),
          missing_scenarios: z.array(z.string()).describe("List of missing scenarios (e.g., 'Missing security testing')"),
          coverage_breakdown: z.object({
            positive_coverage: z.boolean(),
            negative_coverage: z.boolean(),
            boundary_coverage: z.boolean(),
            security_coverage: z.boolean(),
            accessibility_coverage: z.boolean(),
            api_validation: z.boolean()
          })
        }).describe("Evaluation of the test cases quality")
      }),
      prompt: `Platform Context: ${platform}\n\nRequirement:\n${text}`,
      systemInstruction: `You are an expert Principal QA Engineer and Test Analyst. Your objective is to read software requirements and generate detailed test cases.

Step 1: Generate Detailed Test Cases
Create detailed step-by-step test cases covering the requirements. Ensure deep coverage, including edge cases, negative flows, and boundary conditions. For each test case, carefully evaluate and assign a Risk Level (High/Medium/Low) based on the business impact and probability of failure, and provide a brief justification.

Step 2: Quality Evaluation
Critically evaluate the generated test cases. Calculate requirement coverage, identify duplicate test cases, and determine if any critical coverage areas (Positive, Negative, Boundary, Security, Accessibility, API Validation) are missing. Provide an overall quality score (0-100).`
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error('Error generating tests:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate test cases' }, { status: 500 });
  }
}
