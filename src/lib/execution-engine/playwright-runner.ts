import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { queueManager, ExecutionJob } from './queue';
import { generatePlaywrightPOM } from './pom-generator';
import { parseAIConfig } from '../ensemble';
import prisma from '../prisma';

const execPromise = util.promisify(exec);

export async function executePlaywrightPOM(job: ExecutionJob) {
  const { runId, projectId, testCaseIds, websiteUrl } = job;
  const projectDir = path.join(process.cwd(), 'public', 'storage', 'test-runs', 'pw-project', runId);

  // Setup directories
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'pages'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'tests'), { recursive: true });
  }

  queueManager.addLog(runId, `[System] Setting up Playwright POM Execution Engine...`);
  
  try {
    // 1. Fetch Project & Filter Selected Test Cases
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || !project.testCases) throw new Error(`Project or test cases not found.`);

    const testCasesSource = (project.testCases as any).test_cases || [];
    const selectedTestCases = testCasesSource.filter((tc: any) => testCaseIds.includes(tc.test_case_id));

    if (selectedTestCases.length === 0) throw new Error(`No valid matching test cases found.`);

    const tc = selectedTestCases[0]; // For MVP, we run the first one
    queueManager.addLog(runId, `[AI Agent] Generating Page Object Models (POM) and Spec files...`);

    // We assume default config for agentic AI from env if not passed in job
    const aiConfig = job.aiConfig || parseAIConfig(null, null);

    const generated = await generatePlaywrightPOM({
      id: tc.test_case_id,
      testCaseId: tc.test_case_id,
      title: tc.title || tc.summary || "Generated Test",
      description: tc.summary || "",
      preconditions: tc.preconditions || "",
      steps: (typeof tc.steps === 'string' ? tc.steps.split('\n').filter((s: string) => s.trim().length > 0) : (tc.steps || [])).map((s: string) => ({ step: s, expectedResult: tc.expected_result || "" }))
    }, websiteUrl, aiConfig);

    queueManager.addLog(runId, `[System] Writing generated Playwright files to disk...`);
    fs.writeFileSync(path.join(projectDir, 'playwright.config.ts'), generated.configFile);
    fs.writeFileSync(path.join(projectDir, 'pages', 'MainPage.ts'), generated.pomFile);
    fs.writeFileSync(path.join(projectDir, 'tests', 'test.spec.ts'), generated.specFile);
    fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
      name: "pw-execution",
      devDependencies: { "@playwright/test": "^1.40.0" }
    }));

    queueManager.addLog(runId, `[Execution Engine] Launching Playwright runner...`);
    queueManager.updateJobStatus(runId, 'Running');
    queueManager.updateJobProgress(runId, 50, 100);

    try {
      const { stdout, stderr } = await execPromise('npx playwright test --reporter=html', {
        cwd: projectDir,
        env: { ...process.env, CI: 'true' }
      });
      queueManager.addLog(runId, `[Playwright] ${stdout}`);
    } catch (pwError: any) {
      queueManager.addLog(runId, `[Playwright] Test failed or produced warnings. Output: ${pwError.stdout || pwError.message}`);
    }

    queueManager.updateJobProgress(runId, 100, 100);
    queueManager.addLog(runId, `[System] Execution completed successfully. Evidence captured!`);

  } catch (e: any) {
    queueManager.addLog(runId, `[Error] ${e.message || e}`);
    throw e;
  }
}
