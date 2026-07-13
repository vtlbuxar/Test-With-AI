import { generateObject, generateText, LanguageModel } from 'ai';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { groq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

// Initialize custom providers (keys are automatically picked up from process.env)
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || 'dummy_key_to_prevent_init_crash',
});

/**
 * Generates an object using a "Mixture of Experts" ensemble approach.
 * 1. Queries multiple fast, free models simultaneously for raw ideas.
 * 2. Feeds all raw ideas into a highly capable "Judge" model (Gemini 2.5 Pro) to synthesize the best, deduplicated output.
 */
export async function generateEnsembleObject<T>({
  schema,
  prompt,
  systemInstruction = "You are an expert QA and Test Analyst.",
  apiKeys,
}: {
  schema: z.ZodType<T>;
  prompt: string;
  systemInstruction?: string;
  apiKeys?: { gemini?: string };
}): Promise<T> {
  
  const googleModel = apiKeys?.gemini 
    ? createGoogleGenerativeAI({ apiKey: apiKeys.gemini })('gemini-2.5-flash')
    : google('gemini-2.5-flash');

  const rawModels: LanguageModel[] = [
    googleModel
  ];

  // Only add Groq and OpenRouter if API keys are actually present to prevent unnecessary failing network requests
  if (process.env.GROQ_API_KEY) {
    rawModels.push(groq('llama-3.1-8b-instant'));
  }
  
  if (process.env.OPENROUTER_API_KEY) {
    rawModels.push(openrouter('meta-llama/llama-3.1-8b-instruct:free'));
  }

  // Step 1: Run fast inexpensive models in parallel to generate raw text ideas
  const rawGenerations = await Promise.allSettled(
    rawModels.map(model => 
      generateText({
        model,
        system: systemInstruction,
        prompt: prompt + "\n\nProvide a comprehensive response in raw text or markdown format.",
      })
    )
  );

  const successfulOutputs = rawGenerations
    .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
    .map(result => result.value.text);

  if (successfulOutputs.length === 0) {
    const errorDetails = rawGenerations
      .map((result, index) => {
        if (result.status === 'rejected') {
          return `Model ${index + 1} failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`;
        }
        return null;
      })
      .filter(Boolean)
      .join(' | ');

    console.error("Ensemble generation failed. Details:", errorDetails);
    throw new Error(`All ensemble models failed to generate content. Details: ${errorDetails}`);
  }

  // Step 2: Synthesize and format using the most capable model
  const synthesisPrompt = `
    You are an expert QA Judge and Synthesizer. 
    Below are several proposed outputs from different AI assistants for the following request:
    
    <original_request>
    ${prompt}
    </original_request>

    <assistant_outputs>
    ${successfulOutputs.map((out, i) => `=== ASSISTANT ${i + 1} ===\n${out}\n`).join('\n')}
    </assistant_outputs>

    Your task:
    1. Review all the assistant outputs carefully.
    2. Combine the best ideas from all of them into a single master response.
    3. Remove any duplicates or contradictory information.
    4. Ensure the final output strictly adheres to the requested JSON schema structure.
  `;

  const { object } = await generateObject({
    model: googleModel,
    schema,
    prompt: synthesisPrompt,
  });

  return object as T;
}
