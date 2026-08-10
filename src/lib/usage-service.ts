import prisma from './prisma';
import { getSession } from './auth';

export interface LogUsageParams {
  userId?: string;
  workspaceId?: string;
  apiKeyId?: string;
  provider: string;
  model: string;
  requestType: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  fallbackUsed?: boolean;
  fallbackProvider?: string;
  fallbackModel?: string;
}

// Pricing per million tokens (input / output)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'claude-3-5-sonnet-latest': { input: 3.00, output: 15.00 },
  'claude-3-5-haiku-latest': { input: 0.80, output: 4.00 },
  'gpt-4o': { input: 5.00, output: 15.00 },
  'gpt-4o-mini': { input: 0.150, output: 0.600 },
  'deepseek-chat': { input: 0.14, output: 0.28 },
  // Groq models are free / rate-limited for developer tier in this context
  'llama-3.1-8b-instant': { input: 0, output: 0 },
  'llama-3.3-70b-versatile': { input: 0, output: 0 },
};

export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Estimate: 1 token ≈ 4 characters
  return Math.round(text.length / 4);
}

export function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const modelKey = Object.keys(MODEL_PRICING).find(key => model.includes(key));
  if (!modelKey) return 0;
  const pricing = MODEL_PRICING[modelKey];
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return Number((inputCost + outputCost).toFixed(6));
}

export async function recordAiUsage(params: LogUsageParams) {
  try {
    let finalUserId = params.userId;

    // Resolve userId if not provided
    if (!finalUserId) {
      try {
        const session: any = await getSession();
        if (session && session.userId) {
          finalUserId = session.userId;
        }
      } catch (e) {
        // ignore if not running in Request context (e.g. scripts or test runs)
      }
    }

    if (!finalUserId) {
      const firstUser = await prisma.user.findFirst({ select: { id: true } });
      if (firstUser) {
        finalUserId = firstUser.id;
      } else {
        console.error('[UsageService] No user found in database to log usage.');
        return;
      }
    }

    const estimatedCost = calculateCost(params.model, params.promptTokens, params.completionTokens);

    const log = await prisma.aiUsageLog.create({
      data: {
        userId: finalUserId,
        workspaceId: params.workspaceId || null,
        apiKeyId: params.apiKeyId || null,
        provider: params.provider,
        model: params.model,
        requestType: params.requestType,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        totalTokens: params.totalTokens,
        estimatedCost,
        durationMs: params.durationMs,
        status: params.status,
        errorMessage: params.errorMessage || null,
        fallbackUsed: params.fallbackUsed || false,
        fallbackProvider: params.fallbackProvider || null,
        fallbackModel: params.fallbackModel || null,
      },
    });

    return log;
  } catch (err) {
    console.error('[UsageService] Failed to write usage log:', err);
  }
}
