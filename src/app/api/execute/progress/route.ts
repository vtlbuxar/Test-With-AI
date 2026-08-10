import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queueManager } from '@/lib/execution-engine/queue';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session: any = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const runId = searchParams.get('runId');

    if (!runId) {
      return NextResponse.json({ error: 'Missing runId query parameter' }, { status: 400 });
    }

    // 1. Always query database details first (including nested test case title relations)
    const dbRun = await prisma.testRun.findUnique({
      where: { id: runId },
      include: {
        executions: {
          include: {
            steps: true,
            attachments: true,
            testCaseVersion: {
              include: {
                testCase: true,
                steps: true
              }
            }
          }
        },
        metrics: true
      }
    });

    // 2. Check if in active/in-memory queue history
    const memoryJob = queueManager.getJob(runId);
    if (memoryJob) {
      return NextResponse.json({
        runId: memoryJob.runId,
        status: memoryJob.status,
        progressLogs: memoryJob.progressLogs,
        currentStepIndex: memoryJob.currentStepIndex,
        totalSteps: memoryJob.totalSteps,
        createdAt: memoryJob.createdAt,
        tcResultsMap: memoryJob.tcResultsMap || {},
        dbDetails: dbRun || undefined
      }, { status: 200 });
    }

    if (!dbRun) {
      return NextResponse.json({ error: 'Job execution run not found' }, { status: 404 });
    }

    // 3. Fallback: Completed run log construction
    const completedLogs = [
      `[System] Load execution from archive...`,
      `[System] Run started at ${dbRun.startedAt?.toLocaleTimeString() || dbRun.createdAt.toLocaleTimeString()}`,
      dbRun.completedAt ? `[System] Run completed at ${dbRun.completedAt.toLocaleTimeString()}` : '',
      dbRun.metrics ? `[Metrics] Pass rate: ${dbRun.metrics.passRatePercentage}%. Total: ${dbRun.metrics.totalTests}. Passed: ${dbRun.metrics.passedCount}. Failed: ${dbRun.metrics.failedCount}.` : ''
    ].filter(Boolean);

    return NextResponse.json({
      runId: dbRun.id,
      status: dbRun.status === 'RUNNING' ? 'Running' : 'Completed',
      progressLogs: completedLogs,
      currentStepIndex: dbRun.metrics?.totalTests || 0,
      totalSteps: dbRun.metrics?.totalTests || 0,
      createdAt: dbRun.createdAt.getTime(),
      tcResultsMap: {},
      dbDetails: dbRun
    }, { status: 200 });

  } catch (error) {
    console.error('Failed to retrieve progress logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
