export interface LlamaPipelineMetadata {
  provider: string;
  model: string;
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  jsonExtracted: boolean;
  repairApplied: boolean;
  normalizationApplied: boolean;
  retryCount: number;
  validationErrors: string[];
  fallbackUsed: boolean;
  status: 'Success' | 'Failed';
  attempts?: Array<{ model: string; provider: string; error: string }>;
}

/**
 * Builds the comprehensive GenerationSummary telemetry data for Llama pipeline calls.
 */
export function buildLlamaSummary(metadata: LlamaPipelineMetadata) {
  return {
    provider: metadata.provider,
    model: metadata.model,
    durationMs: metadata.durationMs,
    tokens: metadata.totalTokens,
    fallbackUsed: metadata.fallbackUsed,
    status: metadata.status,
    retryCount: metadata.retryCount,
    jsonExtracted: metadata.jsonExtracted,
    repairApplied: metadata.repairApplied,
    normalizationApplied: metadata.normalizationApplied,
    validationErrors: metadata.validationErrors,
    attempts: metadata.attempts || [],
  };
}
