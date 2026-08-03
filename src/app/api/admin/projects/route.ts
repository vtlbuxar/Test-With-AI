import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET all projects with owners and settings
export async function GET() {
  try {
    const session: any = await getSession();

    if (!session || (session.role !== 'Analyst' && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        settings: {
          select: {
            defaultModel: true,
            enableAutoAnalysis: true
          }
        }
      }
    });

    const formattedProjects = projects.map(proj => {
      // Estimate token consumption/costs per project based on stored sizes of JSON blobs
      const sizeEstimate = 
        (JSON.stringify(proj.analysis || '').length +
        JSON.stringify(proj.scenarios || '').length +
        JSON.stringify(proj.testCases || '').length +
        JSON.stringify(proj.rtm || '').length +
        JSON.stringify(proj.suites || '').length) || 0;
      
      const estimatedTokens = Math.round(sizeEstimate / 4) + 1200; // rough input/output tokens approximation
      const estimatedCost = estimatedTokens * 0.000002; // Gemini Flash baseline cost approximation

      return {
        id: proj.id,
        owner: proj.user?.name || proj.user?.email || 'Unknown User',
        ownerEmail: proj.user?.email || '',
        createdAt: proj.createdAt,
        requirementSummary: proj.requirementText ? proj.requirementText.substring(0, 100) + (proj.requirementText.length > 100 ? '...' : '') : 'No requirements text',
        model: proj.settings?.defaultModel || 'gemini-2.0-flash',
        tokensUsed: estimatedTokens,
        estimatedCost: Number(estimatedCost.toFixed(4)),
        status: proj.suites ? 'Completed' : 'Draft'
      };
    });

    return NextResponse.json({ projects: formattedProjects }, { status: 200 });
  } catch (error: any) {
    console.error('Admin projects GET error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

// DELETE project
export async function DELETE(req: NextRequest) {
  try {
    const session: any = await getSession();

    if (!session || (session.role !== 'Analyst' && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required.' }, { status: 400 });
    }

    await prisma.project.delete({
      where: { id: projectId }
    });

    return NextResponse.json({ message: 'Project deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Admin projects DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
