import { generateObject, LanguageModel } from 'ai';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { groq, createGroq } from '@ai-sdk/groq';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { recordAiUsage, estimateTokens } from './usage-service';
import { runLlamaPipeline } from './llama';

export interface ProviderConfig {
  apiKey?: string;
}

export interface AIConfig {
  providers: {
    gemini?: ProviderConfig;
    openai?: ProviderConfig;
    anthropic?: ProviderConfig;
    groq?: ProviderConfig;
    openrouter?: ProviderConfig;
    deepseek?: ProviderConfig;
  };
  fallbackOrder: string[];
  defaultModel: string;
}

export interface GenerationSummary {
  provider: string;
  model: string;
  durationMs: number;
  tokens: number;
  fallbackUsed: boolean;
  status: 'Success' | 'Error';
  fallbackReason?: string;
  attempts: Array<{ model: string; provider: string; error: string }>;
}

export function parseAIConfig(headerVal: string | null, geminiKeyHeader?: string | null): AIConfig {
  const defaultConfig: AIConfig = {
    providers: {
      gemini: { apiKey: geminiKeyHeader || process.env.GEMINI_API_KEY || '' },
      groq: { apiKey: process.env.GROQ_API_KEY || '' },
      openrouter: { apiKey: process.env.OPENROUTER_API_KEY || '' },
      openai: { apiKey: process.env.OPENAI_API_KEY || '' },
      anthropic: { apiKey: process.env.ANTHROPIC_API_KEY || '' },
      deepseek: { apiKey: process.env.DEEPSEEK_API_KEY || '' },
    },
    fallbackOrder: ['gemini-2.0-flash', 'openai/gpt-oss-20b'],
    defaultModel: 'gemini-2.0-flash',
  };

  if (!headerVal) return defaultConfig;

  try {
    const decoded = JSON.parse(decodeURIComponent(headerVal));
    
    const mergedProviders = {
      gemini: { apiKey: decoded.providers?.gemini?.apiKey || geminiKeyHeader || process.env.GEMINI_API_KEY || '' },
      openai: { apiKey: decoded.providers?.openai?.apiKey || process.env.OPENAI_API_KEY || '' },
      anthropic: { apiKey: decoded.providers?.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY || '' },
      groq: { apiKey: decoded.providers?.groq?.apiKey || process.env.GROQ_API_KEY || '' },
      openrouter: { apiKey: decoded.providers?.openrouter?.apiKey || process.env.OPENROUTER_API_KEY || '' },
      deepseek: { apiKey: decoded.providers?.deepseek?.apiKey || process.env.DEEPSEEK_API_KEY || '' },
    };

    return {
      providers: mergedProviders,
      fallbackOrder: decoded.fallbackOrder || defaultConfig.fallbackOrder,
      defaultModel: decoded.defaultModel || defaultConfig.defaultModel,
    };
  } catch (e) {
    console.error("Failed to parse X-AI-Config header:", e);
    return defaultConfig;
  }
}

function getProviderNameForModel(modelId: string): string {
  if (modelId.startsWith('gemini-')) return 'Google AI';
  if (modelId.startsWith('claude-')) return 'Anthropic';
  if (modelId.startsWith('llama-') || modelId.includes('gpt-oss')) return 'Groq';
  if (modelId.startsWith('gpt-')) return 'OpenAI';
  if (modelId.startsWith('openrouter/')) return 'OpenRouter';
  if (modelId.startsWith('deepseek-')) return 'DeepSeek';
  return 'Unknown';
}

function getModelInstance(modelId: string, config: AIConfig): LanguageModel {
  // 1. Google Gemini
  if (modelId.startsWith('gemini-')) {
    const key = config.providers.gemini?.apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Google Gemini API Key is missing");
    return createGoogleGenerativeAI({ apiKey: key })(modelId);
  }
  
  // 2. Anthropic Claude
  if (modelId.startsWith('claude-')) {
    const key = config.providers.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("Anthropic Claude API Key is missing");
    return createAnthropic({ apiKey: key })(modelId);
  }

  // 3. Groq
  if (modelId.startsWith('llama-') || modelId.includes('gpt-oss')) {
    const key = config.providers.groq?.apiKey || process.env.GROQ_API_KEY;
    if (!key) throw new Error("Groq API Key is missing");
    return createGroq({ apiKey: key })(modelId);
  }

  // 4. OpenAI
  if (modelId.startsWith('gpt-')) {
    const key = config.providers.openai?.apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OpenAI API Key is missing");
    return createOpenAI({ apiKey: key })(modelId);
  }

  // 5. OpenRouter
  if (modelId.startsWith('openrouter/')) {
    const key = config.providers.openrouter?.apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OpenRouter API Key is missing");
    const routerModelId = modelId.replace(/^openrouter\//, '');
    return createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: key,
    })(routerModelId);
  }

  // 6. DeepSeek
  if (modelId.startsWith('deepseek-')) {
    const key = config.providers.deepseek?.apiKey || process.env.DEEPSEEK_API_KEY;
    if (!key) throw new Error("DeepSeek API Key is missing");
    return createOpenAI({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: key,
    })(modelId);
  }

  throw new Error(`Unsupported model identifier: ${modelId}`);
}

function zodToSimpleSchemaString(schema: any): string {
  if (!schema) return "";
  try {
    if (schema._def?.schema) {
      return zodToSimpleSchemaString(schema._def.schema);
    }
    if (schema.shape) {
      const keys = Object.keys(schema.shape);
      const props = keys.map(k => {
        const val = schema.shape[k];
        return `"${k}": ${zodToSimpleSchemaString(val)}`;
      }).join(",\n  ");
      return `{\n  ${props}\n}`;
    }
    if (schema.element) {
      return `[\n  ${zodToSimpleSchemaString(schema.element)}\n]`;
    }
    const typeName = schema._def?.typeName;
    if (typeName === 'ZodString') {
      const desc = schema.description || "string";
      return `"${desc}"`;
    }
    if (typeName === 'ZodNumber') {
      return "number";
    }
    if (typeName === 'ZodBoolean') {
      return "boolean";
    }
  } catch (e) {}
  return "any";
}

/**
 * Generates an object using a priority-ordered model fallback chain.
 * Starts with the defaultModel, and if it fails, falls back sequentially
 * through the fallbackOrder list until success.
 */
export async function generateEnsembleObject<T>({
  schema,
  prompt,
  systemInstruction = "You are an expert QA and Test Analyst.",
  aiConfig,
  userId,
  workspaceId,
  requestType = "/api/unknown",
}: {
  schema: z.ZodType<T>;
  prompt: string;
  systemInstruction?: string;
  aiConfig: AIConfig;
  userId?: string;
  workspaceId?: string;
  requestType?: string;
}): Promise<{
  result: T;
  summary: GenerationSummary;
}> {
  const executionList = [
    aiConfig.defaultModel,
    ...aiConfig.fallbackOrder.filter(m => m !== aiConfig.defaultModel),
  ];

  const attempts: Array<{ model: string; provider: string; error: string }> = [];
  const startTime = Date.now();

  for (let i = 0; i < executionList.length; i++) {
    const currentModelId = executionList[i];
    const providerName = getProviderNameForModel(currentModelId);
    
    console.log(`[AI-Config] ⚡ Attempt ${i + 1}/${executionList.length}: model='${currentModelId}' provider='${providerName}'`);
    
    const attemptStartTime = Date.now();
    try {
      const model = getModelInstance(currentModelId, aiConfig);
      
      // Route Llama / Groq models through the dedicated fault-tolerant Llama pipeline
      if (currentModelId.startsWith('llama-') || currentModelId.includes('gpt-oss')) {
        const llamaRes = await runLlamaPipeline({
          model,
          schema,
          prompt,
          systemInstruction,
          modelId: currentModelId,
          providerName,
          userId,
          workspaceId,
          requestType,
          executionIndex: i,
          attemptStartTime,
          startTime,
          attempts,
        });

        console.log(`  ✅ Llama Pipeline Success: model='${currentModelId}' (duration=${llamaRes.summary.durationMs}ms, tokens=${llamaRes.summary.tokens})`);
        return llamaRes;
      }

      // Structured providers (Gemini, Claude, OpenAI, DeepSeek) continue using standard generateObject()
      const { object, usage } = await generateObject({
        model,
        schema,
        system: systemInstruction,
        prompt,
      });

      const attemptDuration = Date.now() - attemptStartTime;
      const totalDuration = Date.now() - startTime;
      
      const pTokens = usage?.inputTokens || estimateTokens(prompt);
      const cTokens = usage?.outputTokens || estimateTokens(JSON.stringify(object));
      const tokenCount = usage?.totalTokens || (pTokens + cTokens);

      console.log(`  ✅ Success: model='${currentModelId}' (duration=${attemptDuration}ms, tokens=${tokenCount})`);
      
      // Log successful usage asynchronously
      recordAiUsage({
        userId,
        workspaceId,
        provider: providerName,
        model: currentModelId,
        requestType,
        promptTokens: pTokens,
        completionTokens: cTokens,
        totalTokens: tokenCount,
        durationMs: attemptDuration,
        status: 'SUCCESS',
        fallbackUsed: i > 0,
        fallbackProvider: i > 0 ? getProviderNameForModel(aiConfig.defaultModel) : undefined,
        fallbackModel: i > 0 ? aiConfig.defaultModel : undefined,
      }).catch(err => console.error("Error logging successful usage:", err));

      return {
        result: object as T,
        summary: {
          provider: providerName,
          model: currentModelId,
          durationMs: totalDuration,
          tokens: tokenCount,
          fallbackUsed: i > 0,
          status: 'Success',
          fallbackReason: i > 0 && attempts.length > 0 ? attempts[attempts.length - 1].error : undefined,
          attempts,
        },
      };
    } catch (err: any) {
      const errMsg = err.message || String(err);
      console.warn(`  ❌ Attempt failed: model='${currentModelId}' error='${errMsg}'`);
      attempts.push({
        model: currentModelId,
        provider: providerName,
        error: errMsg.slice(0, 150),
      });
    }
  }

  const totalDuration = Date.now() - startTime;
  const combinedErrors = attempts.map(a => `${a.model}: ${a.error}`).join(' | ');

  // Log failed usage asynchronously
  recordAiUsage({
    userId,
    workspaceId,
    provider: getProviderNameForModel(aiConfig.defaultModel),
    model: aiConfig.defaultModel,
    requestType,
    promptTokens: estimateTokens(prompt),
    completionTokens: 0,
    totalTokens: estimateTokens(prompt),
    durationMs: totalDuration,
    status: 'FAILED',
    errorMessage: combinedErrors,
  }).catch(err => console.error("Error logging failed usage:", err));
  
  throw new Error(`All configured models failed. Attempts: ${combinedErrors}`);
}
