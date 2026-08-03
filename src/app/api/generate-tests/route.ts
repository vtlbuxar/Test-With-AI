import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { extractTextFromRequest } from '@/lib/file-parser';
import { generateEnsembleObject, parseAIConfig } from '@/lib/ensemble';

export const maxDuration = 60;

/** Normalise whatever the model returns to a valid risk level value */
function normalizeRiskLevel(val: string): "High" | "Medium" | "Low" {
  const n = val.trim().toLowerCase();
  if (n === 'high') return 'High';
  if (n === 'low') return 'Low';
  return 'Medium';
}

// Schemas split into separate focused calls to avoid schema-too-complex errors
const testCasesSchema = z.object({
  test_cases: z.array(
    z.object({
      test_case_id: z.string(),
      type: z.string(),
      summary: z.string(),
      steps: z.string(),
      expected_result: z.string(),
      priority: z.string(),
      risk_level: z.string(),
      risk_justification: z.string().optional(),
    })
  ),
});

const qualityScoreSchema = z.object({
  quality_score: z.object({
    overall_score_percentage: z.number(),
    requirement_coverage_percentage: z.number(),
    duplicate_count: z.number(),
    missing_scenarios: z.array(z.string()),
    coverage_breakdown: z.object({
      positive_coverage: z.boolean(),
      negative_coverage: z.boolean(),
      boundary_coverage: z.boolean(),
      security_coverage: z.boolean(),
      accessibility_coverage: z.boolean(),
      api_validation: z.boolean(),
    }),
  }),
});

export async function POST(req: NextRequest) {
  const startTime = Date.now();
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

    const { platform, text } = await extractTextFromRequest(req);

    const basePrompt = `Platform Context: ${platform}\n\nRequirement:\n${text}`;

    // Run both generations in parallel for performance
    const [testCasesResult, qualityScoreResult] = await Promise.all([
      generateEnsembleObject({
        aiConfig,
        requestType: '/api/generate-tests',
        schema: testCasesSchema,
        prompt: basePrompt,
        systemInstruction: `You are an expert Principal QA Engineer and Test Analyst. Generate detailed test cases covering the requirements with deep coverage including edge cases, negative flows, and boundary conditions. For each test case assign a Risk Level using EXACTLY one of: "High", "Medium", or "Low" (exact casing required).`,
      }),
      generateEnsembleObject({
        aiConfig,
        requestType: '/api/generate-tests/quality-score',
        schema: qualityScoreSchema,
        prompt: basePrompt,
        systemInstruction: `You are an expert QA Quality Analyst. Evaluate the quality of test coverage for the given requirements. Calculate an overall quality score (0-100), requirement coverage percentage, count of likely duplicate test cases, list any missing coverage areas, and assess whether Positive, Negative, Boundary, Security, Accessibility, and API Validation scenarios are covered.`,
      }),
    ]);

    // Normalise risk_level casing
    const normalizedTestCases = testCasesResult.result.test_cases.map(tc => ({
      ...tc,
      risk_level: normalizeRiskLevel(tc.risk_level),
    }));

    const modelUsed = [testCasesResult.summary.model, qualityScoreResult.summary.model]
      .filter((v, i, a) => a.indexOf(v) === i) // deduplicate
      .join(' + ');

    const providerUsed = [testCasesResult.summary.provider, qualityScoreResult.summary.provider]
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(' + ');

    const combinedSummary = {
      provider: providerUsed,
      model: modelUsed,
      durationMs: Date.now() - startTime,
      tokens: testCasesResult.summary.tokens + qualityScoreResult.summary.tokens,
      fallbackUsed: testCasesResult.summary.fallbackUsed || qualityScoreResult.summary.fallbackUsed,
      status: 'Success',
      fallbackReason: testCasesResult.summary.fallbackReason || qualityScoreResult.summary.fallbackReason,
      attempts: [...testCasesResult.summary.attempts, ...qualityScoreResult.summary.attempts],
    };

    return NextResponse.json(
      { test_cases: normalizedTestCases, quality_score: qualityScoreResult.result.quality_score },
      {
        headers: {
          'X-Model-Used': modelUsed,
          'X-Generation-Summary': encodeURIComponent(JSON.stringify(combinedSummary))
        }
      }
    );
  } catch (error) {
    console.error('Error generating tests:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate test cases' },
      { status: 500 }
    );
  }
}
