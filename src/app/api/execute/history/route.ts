import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session: any = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status'); // e.g. "Failed", "Completed"
    
    const where: any = {};
    if (statusFilter) {
      where.status = statusFilter;
    }

    const runs = await prisma.testRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: {
            id: true,
            requirementText: true
          }
        },
        metrics: true
      }
    });

    return NextResponse.json({ runs }, { status: 200 });

  } catch (error) {
    console.error('Failed to get execution history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
