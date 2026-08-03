import { NextResponse } from 'next/server';
import { z } from 'zod';
import { extractTextFromRequest } from '@/lib/file-parser';
import { generateEnsembleObject, parseAIConfig } from '@/lib/ensemble';

export async function POST(req: Request) {
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

    const { platform, text: requirementText } = await extractTextFromRequest(req);

    // All fields are required strings so the JSON schema `required` array is always complete.
    // risk_level uses z.string() to avoid enum-constraint errors at the API level.
    const TestCaseSchema = z.object({
      test_case_id: z.string(),
      title: z.string().optional(),
      type: z.string(),
      summary: z.string(),
      steps: z.string(),
      expected_result: z.string(),
      priority: z.string(),
      justification: z.string().optional(),
      risk_level: z.string(),
      risk_justification: z.string().optional(),
    });

    const baseContext = `
Requirement for a ${platform} application:
${requirementText}

Use EXACTLY one of these values for risk_level: "High", "Medium", or "Low" (exact casing required).
    `.trim();

    // Run smoke and regression generation in parallel with separate focused schemas
    const [smokeResult, regressionResult] = await Promise.all([
      generateEnsembleObject({
        aiConfig,
        requestType: '/api/generate-suites/smoke',
        schema: z.object({ smoke_tests: z.array(TestCaseSchema) }),
        prompt: `${baseContext}\n\nGenerate Smoke Tests only: the minimal set of critical-path tests that must pass for a build to be considered testable. Focus on core functionality and happy paths.`,
        systemInstruction: "You are an expert Test Manager. Generate focused smoke test cases that cover the most critical functionality.",
      }),
      generateEnsembleObject({
        aiConfig,
        requestType: '/api/generate-suites/regression',
        schema: z.object({ regression_tests: z.array(TestCaseSchema) }),
        prompt: `${baseContext}\n\nGenerate Regression Tests only: comprehensive tests to ensure all existing functionality continues to work correctly after changes. Cover edge cases, negative scenarios, and boundary conditions.`,
        systemInstruction: "You are an expert Test Manager. Generate thorough regression test cases that ensure full coverage.",
      }),
    ]);

    // Normalise risk_level casing
    function normalizeRiskLevel(val: string): "High" | "Medium" | "Low" {
      const n = val.trim().toLowerCase();
      if (n === 'high') return 'High';
      if (n === 'low') return 'Low';
      return 'Medium';
    }

    const normalize = (tc: (typeof smokeResult.result.smoke_tests)[number]) => ({
      ...tc,
      risk_level: normalizeRiskLevel(tc.risk_level),
    });

    const modelUsed = [smokeResult.summary.model, regressionResult.summary.model]
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(' + ');

    const providerUsed = [smokeResult.summary.provider, regressionResult.summary.provider]
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(' + ');

    const combinedSummary = {
      provider: providerUsed,
      model: modelUsed,
      durationMs: Date.now() - startTime,
      tokens: smokeResult.summary.tokens + regressionResult.summary.tokens,
      fallbackUsed: smokeResult.summary.fallbackUsed || regressionResult.summary.fallbackUsed,
      status: 'Success',
      fallbackReason: smokeResult.summary.fallbackReason || regressionResult.summary.fallbackReason,
      attempts: [...smokeResult.summary.attempts, ...regressionResult.summary.attempts],
    };

    return NextResponse.json(
      {
        smoke_tests: smokeResult.result.smoke_tests.map(normalize),
        regression_tests: regressionResult.result.regression_tests.map(normalize),
      },
      {
        headers: {
          'X-Model-Used': modelUsed,
          'X-Generation-Summary': encodeURIComponent(JSON.stringify(combinedSummary))
        }
      }
    );
  } catch (error: any) {
    console.error('Error generating suites:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
