import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queueManager } from '@/lib/execution-engine/queue';

export async function POST(req: NextRequest) {
  try {
    const session: any = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { runId, action } = body;

    if (!runId || !action) {
      return NextResponse.json({ error: 'Missing runId or action parameters' }, { status: 400 });
    }

    let success = false;
    if (action === 'PAUSE') {
      success = queueManager.pause(runId);
    } else if (action === 'RESUME') {
      success = queueManager.resume(runId);
    } else if (action === 'CANCEL') {
      success = queueManager.cancel(runId);
    } else {
      return NextResponse.json({ error: 'Invalid action command' }, { status: 400 });
    }

    if (success) {
      return NextResponse.json({
        message: `Command ${action} applied successfully to job ${runId}`
      }, { status: 200 });
    } else {
      return NextResponse.json({
        error: `Could not apply command ${action} (job is not in a valid state for this control action)`
      }, { status: 422 });
    }

  } catch (error) {
    console.error('Failed to control job execution:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
