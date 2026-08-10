import { generateText, LanguageModel } from 'ai';
import { z } from 'zod';
import { extractJson } from './extract-json';
import { repairJson } from './repair-json';
import { normalizeLlamaData } from './normalize';
import { validateWithSchema } from './validate';
import { buildRetryPrompt } from './retry';
import { buildLlamaSummary } from './metadata';
import { recordAiUsage, estimateTokens } from '../usage-service';

export interface RunLlamaPipelineOptions<T> {
  model: LanguageModel;
  schema: z.ZodType<T>;
  prompt: string;
  systemInstruction?: string;
  modelId: string;
  providerName: string;
  userId?: string;
  workspaceId?: string;
  requestType?: string;
  executionIndex: number;
  attemptStartTime: number;
  startTime: number;
  attempts?: Array<{ model: string; provider: string; error: string }>;
}

const LLAMA_SYSTEM_DIRECTIVE = `You are a JSON generation engine.
Return ONLY valid JSON.
Do not include markdown.
Do not explain anything.
Every required field must exist.
Every array must exist even if empty.
Every enum must exactly match the schema.
Never omit properties.
Never add unknown properties.`;

export async function runLlamaPipeline<T>(options: RunLlamaPipelineOptions<T>): Promise<{
  result: T;
  summary: any;
}> {
  const {
    model,
    schema,
    prompt,
    systemInstruction,
    modelId,
    providerName,
    userId,
    workspaceId,
    requestType = '/api/unknown',
    executionIndex,
    attemptStartTime,
    startTime,
  } = options;

  let retryCount = 0;
  let jsonExtracted = false;
  let repairApplied = false;
  let normalizationApplied = false;
  let validationErrors: string[] = [];

  const combinedSystemPrompt = systemInstruction
    ? `${LLAMA_SYSTEM_DIRECTIVE}\n\n${systemInstruction}`
    : LLAMA_SYSTEM_DIRECTIVE;

  // Helper to run a single text generation & processing turn
  const executeAttempt = async (promptText: string) => {
    const { text, usage } = await generateText({
      model,
      system: combinedSystemPrompt,
      prompt: promptText,
    });

    const pTokens = usage?.inputTokens || estimateTokens(promptText);
    const cTokens = usage?.outputTokens || estimateTokens(text);
    const totalTokens = usage?.totalTokens || (pTokens + cTokens);

    // 1. Extract JSON
    const extractionResult = extractJson(text);
    if (extractionResult.extracted) jsonExtracted = true;

    // 2. Repair JSON
    const repairResult = repairJson(extractionResult.jsonText);
    if (repairResult.repairApplied) repairApplied = true;

    // 3. Parse JSON
    let parsedObj: any;
    try {
      parsedObj = JSON.parse(repairResult.repairedText);
    } catch (parseErr: any) {
      throw new Error(`JSON parse error: ${parseErr.message || 'Malformed JSON'}`);
    }

    // 4. Normalize Data & Populate Defaults
    const normResult = normalizeLlamaData(parsedObj);
    if (normResult.normalizationApplied) normalizationApplied = true;

    // 5. Validate with Schema
    const valResult = validateWithSchema(schema, normResult.normalizedData);

    return {
      parsedData: normResult.normalizedData,
      validation: valResult,
      pTokens,
      cTokens,
      totalTokens,
    };
  };

  // Turn 1 Execution
  let result: any;
  let lastTokens = { pTokens: 0, cTokens: 0, totalTokens: 0 };

  try {
    const turn1 = await executeAttempt(prompt);
    lastTokens = { pTokens: turn1.pTokens, cTokens: turn1.cTokens, totalTokens: turn1.totalTokens };

    if (turn1.validation.success && turn1.validation.data) {
      result = turn1.validation.data;
    } else {
      validationErrors = turn1.validation.errors;

      // Turn 2 Execution (1-Shot Retry)
      retryCount = 1;
      console.log(`[Llama-Pipeline] ⚠️ Attempt 1 validation failed for '${modelId}'. Triggering 1-shot retry...`);
      const retryPrompt = buildRetryPrompt(prompt, validationErrors);

      const turn2 = await executeAttempt(retryPrompt);
      lastTokens = {
        pTokens: turn1.pTokens + turn2.pTokens,
        cTokens: turn1.cTokens + turn2.cTokens,
        totalTokens: turn1.totalTokens + turn2.totalTokens,
      };

      if (turn2.validation.success && turn2.validation.data) {
        result = turn2.validation.data;
      } else {
        validationErrors = turn2.validation.errors;
        throw new Error(`No object generated: response did not match schema. Validation errors: ${validationErrors.slice(0, 3).join('; ')}`);
      }
    }
  } catch (err: any) {
    throw new Error(err.message || 'Llama pipeline generation failed');
  }

  const attemptDuration = Date.now() - attemptStartTime;
  const totalDuration = Date.now() - startTime;

  // Record Usage Asynchronously
  recordAiUsage({
    userId,
    workspaceId,
    provider: providerName,
    model: modelId,
    requestType,
    promptTokens: lastTokens.pTokens,
    completionTokens: lastTokens.cTokens,
    totalTokens: lastTokens.totalTokens,
    durationMs: attemptDuration,
    status: 'SUCCESS',
    fallbackUsed: executionIndex > 0,
  }).catch(err => console.error("Error logging Llama pipeline usage:", err));

  const summary = buildLlamaSummary({
    provider: providerName,
    model: modelId,
    durationMs: totalDuration,
    promptTokens: lastTokens.pTokens,
    completionTokens: lastTokens.cTokens,
    totalTokens: lastTokens.totalTokens,
    jsonExtracted,
    repairApplied,
    normalizationApplied,
    retryCount,
    validationErrors,
    fallbackUsed: executionIndex > 0,
    status: 'Success',
    attempts: options.attempts || [],
  });

  return {
    result: result as T,
    summary,
  };
}
