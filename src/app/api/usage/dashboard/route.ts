import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { parseAIConfig } from '@/lib/ensemble';

export async function GET(req: NextRequest) {
  try {
    const session: any = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.userId;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Run aggregations in parallel for maximum performance (<200ms target)
    const [
      todayStats,
      monthStats,
      successCount,
      totalCount,
      recentLogs,
      fallbackLogs,
      lastSuccessLog,
      dbApiKeys
    ] = await Promise.all([
      // 1. Today's stats (Total requests, sum of tokens, sum of estimated cost, avg duration)
      prisma.aiUsageLog.aggregate({
        where: {
          userId,
          createdAt: { gte: startOfToday },
        },
        _count: { id: true },
        _sum: { totalTokens: true, estimatedCost: true },
        _avg: { durationMs: true },
      }),
      // 2. Month's stats (sum of tokens)
      prisma.aiUsageLog.aggregate({
        where: {
          userId,
          createdAt: { gte: startOfMonth },
        },
        _sum: { totalTokens: true },
      }),
      // 3. Today's success count for success rate
      prisma.aiUsageLog.count({
        where: {
          userId,
          createdAt: { gte: startOfToday },
          status: 'SUCCESS',
        },
      }),
      // 4. Today's total count for success rate
      prisma.aiUsageLog.count({
        where: {
          userId,
          createdAt: { gte: startOfToday },
        },
      }),
      // 5. Recent Activity (Last 10 records)
      prisma.aiUsageLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // 6. Fallback History (Last 10 fallback records)
      prisma.aiUsageLog.findMany({
        where: { userId, fallbackUsed: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // 7. Last successful log for active model context
      prisma.aiUsageLog.findFirst({
        where: { userId, status: 'SUCCESS' },
        orderBy: { createdAt: 'desc' },
      }),
      // 8. Find stored API keys in database
      prisma.apiKey.findMany({
        where: { userId, isActive: true },
        select: { provider: true, keyHint: true }
      })
    ]);

    // Parse active config from request headers to see if keys are passed client-side
    const geminiKey = req.headers.get('x-gemini-api-key') || undefined;
    const aiConfigHeader = req.headers.get('x-ai-config');
    const aiConfig = parseAIConfig(aiConfigHeader, geminiKey);

    const isProviderConnected = (providerId: string): boolean => {
      // Check client-side configuration
      const keyMap: Record<string, string | undefined> = {
        gemini: aiConfig.providers.gemini?.apiKey,
        groq: aiConfig.providers.groq?.apiKey,
        openai: aiConfig.providers.openai?.apiKey,
        anthropic: aiConfig.providers.anthropic?.apiKey,
        openrouter: aiConfig.providers.openrouter?.apiKey,
        deepseek: aiConfig.providers.deepseek?.apiKey,
      };
      if (keyMap[providerId]) return true;

      // Check stored DB API keys
      const dbProviderNames: Record<string, string> = {
        gemini: 'GEMINI',
        openai: 'OPENAI',
        anthropic: 'ANTHROPIC',
        groq: 'GROQ',
        openrouter: 'OPENROUTER',
        deepseek: 'DEEPSEEK'
      };
      return dbApiKeys.some(key => key.provider === dbProviderNames[providerId]);
    };

    // Calculate aggregated providers metrics
    const providersList = ['gemini', 'anthropic', 'openai', 'groq', 'openrouter', 'deepseek'];
    const providerStats = await Promise.all(
      providersList.map(async (prov) => {
        const providerQueryNames: Record<string, string[]> = {
          gemini: ['Google AI', 'Gemini'],
          anthropic: ['Anthropic', 'Claude'],
          openai: ['OpenAI'],
          groq: ['Groq'],
          openrouter: ['OpenRouter'],
          deepseek: ['DeepSeek']
        };

        const orConditions = providerQueryNames[prov].map(p => ({
          provider: { contains: p, mode: 'insensitive' as const }
        }));

        // Find total requests and tokens for this provider
        const aggregation = await prisma.aiUsageLog.aggregate({
          where: { 
            userId, 
            OR: orConditions
          },
          _count: { id: true },
          _sum: { totalTokens: true },
        });

        const lastUsedLog = await prisma.aiUsageLog.findFirst({
          where: { 
            userId, 
            OR: orConditions
          },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true }
        });

        const providerDisplayNames: Record<string, string> = {
          gemini: 'Gemini',
          anthropic: 'Claude',
          openai: 'OpenAI',
          groq: 'Groq',
          openrouter: 'OpenRouter',
          deepseek: 'DeepSeek'
        };

        return {
          provider: providerDisplayNames[prov],
          connected: isProviderConnected(prov),
          requests: aggregation._count.id || 0,
          tokens: aggregation._sum.totalTokens || 0,
          lastUsed: lastUsedLog ? lastUsedLog.createdAt.toISOString() : ''
        };
      })
    );

    // Compute metrics
    const requestsToday = todayStats._count.id || 0;
    const tokensToday = todayStats._sum.totalTokens || 0;
    const tokensMonth = monthStats._sum.totalTokens || 0;
    const estimatedCost = Number((todayStats._sum.estimatedCost || 0).toFixed(4));
    const averageResponseTime = todayStats._avg.durationMs 
      ? Math.round(todayStats._avg.durationMs) 
      : 0;

    const successRate = totalCount > 0 
      ? Number(((successCount / totalCount) * 100).toFixed(1)) 
      : 100.0;

    // Formatting endpoints for display
    const formatEndpoint = (ep: string) => {
      return ep
        .replace('/api/generate-', '')
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    const formattedRecentActivity = recentLogs.map(log => ({
      id: log.id,
      time: log.createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      createdAt: log.createdAt.toISOString(),
      endpoint: formatEndpoint(log.requestType),
      provider: log.provider,
      model: log.model,
      duration: `${(log.durationMs / 1000).toFixed(1)}s`,
      tokens: log.totalTokens,
      status: log.status
    }));

    const formattedFallbackHistory = fallbackLogs.map(log => ({
      id: log.id,
      time: log.createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      createdAt: log.createdAt.toISOString(),
      endpoint: formatEndpoint(log.requestType),
      failedProvider: log.fallbackProvider || 'Primary Model',
      failedModel: log.fallbackModel || 'Primary Model',
      successProvider: log.provider,
      successModel: log.model,
      errorMessage: log.errorMessage || 'Timeout/Unknown error',
      duration: `${(log.durationMs / 1000).toFixed(1)}s`
    }));

    // Active Model
    const activeModel = lastSuccessLog 
      ? { provider: lastSuccessLog.provider, model: lastSuccessLog.model, status: 'Connected' }
      : { provider: 'Google AI', model: 'Gemini 2.0 Flash', status: 'Connected' };

    return NextResponse.json({
      summary: {
        requestsToday,
        tokensToday,
        tokensMonth,
        estimatedCost,
        successRate,
        averageResponseTime
      },
      activeModel,
      providers: providerStats,
      recentActivity: formattedRecentActivity,
      fallbackHistory: formattedFallbackHistory
    }, { status: 200 });

  } catch (error) {
    console.error('Usage dashboard analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
