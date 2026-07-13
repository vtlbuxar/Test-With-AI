require('dotenv').config();
const { generateText } = require('ai');
const { google } = require('@ai-sdk/google');
const { groq } = require('@ai-sdk/groq');
const { createOpenAI } = require('@ai-sdk/openai');

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || 'dummy_key_to_prevent_init_crash',
});

async function testModel(model, name) {
  try {
    const res = await generateText({
      model,
      prompt: 'Say hi',
    });
    console.log(name, 'Success');
  } catch (err) {
    console.error(name, 'Failed:', err.message);
  }
}

async function main() {
  await testModel(google('gemini-2.5-flash'), 'Gemini');
  await testModel(groq('llama-3.1-8b-instant'), 'Groq');
  await testModel(openrouter('google/gemma-7b-it:free'), 'OpenRouter');
}
main();
