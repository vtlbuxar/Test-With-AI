import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { AIConfig, getProviderNameForModel, getModelInstance } from '../ensemble';

export interface TestCaseSteps {
  id: string;
  testCaseId: string;
  title: string;
  description: string;
  preconditions: string;
  steps: Array<{ step: string; expectedResult: string }>;
}

export interface GeneratedPOM {
  pomFile: string;
  specFile: string;
  configFile: string;
}

const systemPrompt = `You are an expert SDET (Software Development Engineer in Test).
You write robust, self-healing Playwright scripts using the Page Object Model (POM) pattern.
Given a natural language test case, you will generate three files:
1. A Playwright config file that records video, traces, and screenshots on failure.
2. A POM class file (e.g. \`MainPage.ts\`) containing locators (using robust \`getByRole\`, \`getByText\`, \`getByLabel\`) and methods.
3. A test spec file (e.g. \`test.spec.ts\`) that imports the POM and uses \`expect()\` for assertions based on the expected results.

Important Rules:
- The POM must strictly encapsulate locators.
- Use async/await correctly.
- Add try-catch blocks or use Playwright's native auto-waiting assertions for stability.
- Include API and UI assertions if the steps imply verifying statuses.
`;

export async function generatePlaywrightPOM(
  testCase: TestCaseSteps,
  url: string,
  aiConfig: AIConfig
): Promise<GeneratedPOM> {
  const modelId = aiConfig.defaultModel;
  const model = getModelInstance(modelId, aiConfig);

  const prompt = `
Generate Playwright POM automation for the following test case.
Target URL: ${url}

Test Case Title: ${testCase.title}
Preconditions: ${testCase.preconditions}
Steps:
${testCase.steps.map((s, i) => `${i + 1}. ${s.step} (Expected: ${s.expectedResult})`).join('\n')}
`;

  const { object } = await generateObject({
    model,
    system: systemPrompt,
    prompt,
    schema: z.object({
      pomFileName: z.string().describe("Name of the POM file e.g. MainPage.ts"),
      pomFileContent: z.string().describe("TypeScript code for the POM class"),
      specFileName: z.string().describe("Name of the spec file e.g. test.spec.ts"),
      specFileContent: z.string().describe("TypeScript code for the Playwright test spec"),
      configFileContent: z.string().describe("TypeScript code for playwright.config.ts enabling videos, screenshots, traces, and html reporter"),
    })
  });

  return {
    pomFile: object.pomFileContent,
    specFile: object.specFileContent,
    configFile: object.configFileContent
  };
}
