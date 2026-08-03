import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session: any = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Date limit: 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Delete projects older than 7 days for all users (cleanup)
    await prisma.project.deleteMany({
      where: {
        createdAt: {
          lt: sevenDaysAgo
        }
      }
    });

    // 2. Fetch projects for current user within the last 7 days
    const projects = await prisma.project.findMany({
      where: {
        userId: session.userId,
        createdAt: {
          gte: sevenDaysAgo
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ projects }, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session: any = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    
    let project;

    if (data.id) {
      // Check if project exists and belongs to user
      const existing = await prisma.project.findUnique({
        where: { id: data.id }
      });

      if (existing) {
        if (existing.userId !== session.userId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Update
        project = await prisma.project.update({
          where: { id: data.id },
          data: {
            requirementText: data.requirementText,
            analysis: data.analysis ?? existing.analysis,
            scenarios: data.scenarios ?? existing.scenarios,
            testCases: data.testCases ?? existing.testCases,
            rtm: data.rtm ?? existing.rtm,
            suites: data.suites ?? existing.suites,
            versions: data.versions ?? existing.versions,
          }
        });
        return NextResponse.json({ project }, { status: 200 });
      }
    }

    // Create new project
    project = await prisma.project.create({
      data: {
        id: data.id || undefined, // use provided id if available
        userId: session.userId,
        requirementText: data.requirementText,
        analysis: data.analysis || null,
        scenarios: data.scenarios || null,
        testCases: data.testCases || null,
        rtm: data.rtm || null,
        suites: data.suites || null,
        versions: data.versions || null,
      }
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Failed to save project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
