import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

export async function POST(req: NextRequest) {
  try {
    const { provider, apiKey } = await req.json();

    if (!provider || !apiKey) {
      return NextResponse.json({ valid: false, error: 'Provider and API Key are required.' }, { status: 400 });
    }

    let modelInstance: any;
    if (provider === 'gemini') {
      modelInstance = createGoogleGenerativeAI({ apiKey })('gemini-1.5-flash');
    } else if (provider === 'groq') {
      modelInstance = createGroq({ apiKey })('llama-3.1-8b-instant');
    } else if (provider === 'openai') {
      modelInstance = createOpenAI({ apiKey })('gpt-4o-mini');
    } else if (provider === 'anthropic') {
      modelInstance = createAnthropic({ apiKey })('claude-3-5-haiku-latest');
    } else if (provider === 'openrouter') {
      modelInstance = createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey,
      })('openrouter/free');
    } else if (provider === 'deepseek') {
      modelInstance = createOpenAI({
        baseURL: 'https://api.deepseek.com/v1',
        apiKey,
      })('deepseek-chat');
    } else {
      return NextResponse.json({ valid: false, error: 'Unsupported provider' }, { status: 400 });
    }

    // Call a lightweight request to validate the key
    await generateText({
      model: modelInstance,
      prompt: 'ping',
      maxTokens: 1,
    } as any);

    return NextResponse.json({ valid: true });
  } catch (error: any) {
    console.error('API key validation failed error details:', error);
    const errMsg = String(error.message || '').toLowerCase();
    
    // Check if the error indicates a quota, rate limit, or billing issue (meaning key is authentic)
    if (
      errMsg.includes('quota') || 
      errMsg.includes('rate limit') || 
      errMsg.includes('rate_limit') || 
      errMsg.includes('billing') || 
      errMsg.includes('429') || 
      errMsg.includes('limit exceeded') || 
      errMsg.includes('limit_exceeded')
    ) {
      return NextResponse.json({ 
        valid: true, 
        warning: 'API Key is valid but has exceeded its current request/billing quota.' 
      });
    }

    return NextResponse.json({
      valid: false,
      error: error.message || 'Verification failed. Please check your API key.',
    });
  }
}
