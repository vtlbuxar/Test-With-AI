import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queueManager } from '@/lib/execution-engine/queue';
import { parseAIConfig } from '@/lib/ensemble';
import crypto from 'crypto';


export async function POST(req: NextRequest) {
  try {
    const session: any = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, testCaseIds, websiteUrl, browser } = body;

    if (!projectId || !testCaseIds || !Array.isArray(testCaseIds) || !websiteUrl) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const aiConfigHeader = req.headers.get('x-ai-config');
    const geminiKeyHeader = req.headers.get('x-gemini-api-key');
    const aiConfig = parseAIConfig(aiConfigHeader, geminiKeyHeader);

    const runId = crypto.randomUUID();
    const job = queueManager.enqueue(
      runId,
      projectId,
      testCaseIds,
      websiteUrl,
      browser || 'chromium',
      aiConfig
    );

    return NextResponse.json({
      message: 'Test execution successfully enqueued.',
      runId: job.runId,
      status: job.status
    }, { status: 202 });

  } catch (error: any) {
    console.error('Failed to trigger execution:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session: any = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      activeJob: queueManager.getActiveJob(),
      queue: queueManager.getQueue()
    }, { status: 200 });

  } catch (error) {
    console.error('Failed to get queue status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
