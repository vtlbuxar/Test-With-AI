import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { extractTextFromRequest } from '@/lib/file-parser';
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

    const { platform, text } = await extractTextFromRequest(req);

    const { result, summary } = await generateEnsembleObject({
      aiConfig,
      requestType: '/api/generate-analysis',
      schema: z.object({
        requirement_analysis: z.string(),
      }),
      prompt: `Platform Context: ${platform}\n\nRequirement:\n${text}`,
      systemInstruction: `You are an expert Principal QA Engineer and Test Analyst. Your objective is to read software requirements and generate a detailed Requirement Analysis.
Analyze the requirement. Identify the primary actors, the core business logic, implicit dependencies, and potential points of failure.
Provide a clear, concise 3-4 sentence summary.`
    });

    return NextResponse.json(result, {
      headers: {
        'X-Model-Used': summary.model,
        'X-Generation-Summary': encodeURIComponent(JSON.stringify(summary))
      }
    });
  } catch (error) {
    console.error('Error generating analysis:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate analysis' }, { status: 500 });
  }
}
