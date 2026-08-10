import { getSession } from './auth';
import prisma from './prisma';
import { AIConfig } from './ensemble';

export async function checkAndIncrementQuota(aiConfig: AIConfig): Promise<{ allowed: boolean, error?: string }> {
  const session: any = await getSession();
  if (!session || !session.userId) return { allowed: false, error: 'Unauthorized' };

  // Determine if the user is using a custom API key for their default model
  const defaultModel = aiConfig.defaultModel;
  let isCustomKey = false;
  
  if (defaultModel.startsWith('gemini-') && aiConfig.providers.gemini?.apiKey && aiConfig.providers.gemini.apiKey !== process.env.GEMINI_API_KEY) isCustomKey = true;
  else if (defaultModel.startsWith('gpt-') && aiConfig.providers.openai?.apiKey && aiConfig.providers.openai.apiKey !== process.env.OPENAI_API_KEY) isCustomKey = true;
  else if (defaultModel.startsWith('claude-') && aiConfig.providers.anthropic?.apiKey && aiConfig.providers.anthropic.apiKey !== process.env.ANTHROPIC_API_KEY) isCustomKey = true;
  else if ((defaultModel.startsWith('llama-') || defaultModel.includes('gpt-oss')) && aiConfig.providers.groq?.apiKey && aiConfig.providers.groq.apiKey !== process.env.GROQ_API_KEY) isCustomKey = true;
  else if (defaultModel.startsWith('openrouter/') && aiConfig.providers.openrouter?.apiKey && aiConfig.providers.openrouter.apiKey !== process.env.OPENROUTER_API_KEY) isCustomKey = true;
  else if (defaultModel.startsWith('deepseek-') && aiConfig.providers.deepseek?.apiKey && aiConfig.providers.deepseek.apiKey !== process.env.DEEPSEEK_API_KEY) isCustomKey = true;

  if (isCustomKey) {
    return { allowed: true };
  }

  // Not a custom key, check quota
  let usage = await prisma.userUsage.findUnique({ where: { userId: session.userId } });
  
  if (!usage) {
    usage = await prisma.userUsage.create({ 
      data: { userId: session.userId, aiGenerationsCount: 0 } 
    });
  }

  // Freemium limit: 3 generations
  if (usage.aiGenerationsCount >= 3) {
    return { allowed: false, error: 'QUOTA_EXCEEDED' };
  }

  // Increment usage
  await prisma.userUsage.update({
    where: { userId: session.userId },
    data: { aiGenerationsCount: { increment: 1 } }
  });

  return { allowed: true };
}
