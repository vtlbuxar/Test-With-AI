import { NextRequest, NextResponse } from 'next/server';
import { generatePlaywrightPOM } from '@/lib/execution-engine/pom-generator';
import { parseAIConfig } from '@/lib/ensemble';
import JSZip from 'jszip';

export async function POST(req: NextRequest) {
  try {
    const aiConfigHeader = req.headers.get('x-ai-config');
    const geminiKeyHeader = req.headers.get('x-gemini-api-key');
    const aiConfig = parseAIConfig(aiConfigHeader, geminiKeyHeader);

    const body = await req.json();
    const { testCase, url } = body;

    if (!testCase || !url) {
      return NextResponse.json({ error: 'Missing testCase or url' }, { status: 400 });
    }

    // Generate the POM using AI
    const generated = await generatePlaywrightPOM(testCase, url, aiConfig);

    // Create a Zip archive
    const zip = new JSZip();
    zip.file('package.json', JSON.stringify({
      name: "playwright-pom-export",
      version: "1.0.0",
      scripts: {
        test: "playwright test"
      },
      devDependencies: {
        "@playwright/test": "^1.40.0",
        "@types/node": "^20.0.0"
      }
    }, null, 2));

    zip.file('playwright.config.ts', generated.configFile);
    
    // Create folders
    const pagesFolder = zip.folder('pages');
    pagesFolder?.file('MainPage.ts', generated.pomFile);

    const testsFolder = zip.folder('tests');
    testsFolder?.file('test.spec.ts', generated.specFile);

    // Generate zip buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Return as a downloadable file
    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="playwright-tests-${testCase.testCaseId || 'export'}.zip"`
      }
    });

  } catch (error: any) {
    console.error("Error generating POM Export:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
