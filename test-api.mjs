import { generateObject } from 'ai';
import { groq } from '@ai-sdk/groq';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function run() {
  console.log('Testing Groq generateObject...');
  try {
    const { object } = await generateObject({
      model: groq('llama-3.1-8b-instant'),
      schema: z.object({ test: z.string() }),
      prompt: 'Hello, give me a test string.'
    });
    console.log('Groq Object OK:', object);
  } catch (e) {
    console.error('Groq Error:', e.message);
  }
}

run();
