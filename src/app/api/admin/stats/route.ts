import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import os from 'os';

export async function GET() {
  try {
    const session: any = await getSession();

    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    // 1. Calculate Database Metrics
    const totalUsers = await prisma.user.count();
    
    // Active users: status is ACTIVE
    const activeUsersToday = await prisma.user.count({
      where: { status: 'ACTIVE' }
    });

    const totalProjects = await prisma.project.count();
    
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const projectsToday = await prisma.project.count({
      where: {
        createdAt: {
          gte: startOfToday
        }
      }
    });

    // AI Usage log aggregates
    const usageLogsCount = await prisma.aiUsageLog.count();
    
    const tokenSum = await prisma.aiUsageLog.aggregate({
      _sum: {
        totalTokens: true
      }
    });

    const costSum = await prisma.aiUsageLog.aggregate({
      _sum: {
        estimatedCost: true
      }
    });

    const durationAvg = await prisma.aiUsageLog.aggregate({
      _avg: {
        durationMs: true
      }
    });

    const failedRequests = await prisma.aiUsageLog.count({
      where: { status: 'FAILED' }
    });

    const successRequests = await prisma.aiUsageLog.count({
      where: { status: 'SUCCESS' }
    });

    const totalTokens = tokenSum._sum.totalTokens || 0;
    const totalCost = costSum._sum.estimatedCost || 0;
    const avgResponseTime = durationAvg._avg.durationMs ? Math.round(durationAvg._avg.durationMs) : 0;
    const successRate = usageLogsCount > 0 
      ? Number(((successRequests / usageLogsCount) * 100).toFixed(2)) 
      : 100;
    const apiErrorRate = usageLogsCount > 0 
      ? Number(((failedRequests / usageLogsCount) * 100).toFixed(2)) 
      : 0;

    // 2. Fetch Recent Audit Logs / User Activity (last 10)
    // We can pull login history and project creations as a unified activity log
    const recentProjects = await prisma.project.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    const recentActivities = [
      ...recentProjects.map(p => ({
        timestamp: p.createdAt,
        user: p.user?.name || p.user?.email || 'System',
        action: 'Project Created',
        resource: p.requirementText ? p.requirementText.substring(0, 40) + '...' : 'New Project',
        status: 'SUCCESS'
      })),
      ...recentUsers.map(u => ({
        timestamp: u.createdAt,
        user: u.name || u.email,
        action: 'User Registered',
        resource: `Role: ${u.role}`,
        status: 'SUCCESS'
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

    // 3. System Metrics (using native node modules + mock dials)
    const cpus = os.cpus();
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const memoryUsagePercentage = Math.round(((totalMem - freeMem) / totalMem) * 100);

    // Dynamic mock CPU calculation
    let cpuUser = 0;
    let cpuTotal = 0;
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        cpuTotal += (cpu.times as any)[type];
      }
      cpuUser += cpu.times.user;
    }
    const cpuUsagePercentage = Math.round((cpuUser / cpuTotal) * 100) || 12;

    const systemHealth = {
      cpu: cpuUsagePercentage,
      memory: memoryUsagePercentage,
      database: 'Healthy',
      databaseLatencyMs: 12,
      apiGateway: 'Operational',
      queueDepth: 0,
      activeSessions: 3,
      osType: os.type(),
      osArch: os.arch(),
      osPlatform: os.platform(),
      osUptime: os.uptime(),
      osCpusCount: cpus.length,
      providers: [
        { name: 'Google AI (Gemini)', status: 'Online', latencyMs: 240 },
        { name: 'Anthropic (Claude)', status: 'Online', latencyMs: 380 },
        { name: 'OpenAI (GPT)', status: 'Online', latencyMs: 310 },
        { name: 'Groq (Llama)', status: 'Online', latencyMs: 180 }
      ]
    };

    return NextResponse.json({
      kpis: {
        totalUsers,
        activeUsersToday,
        totalProjects,
        projectsToday,
        totalAIRequests: usageLogsCount,
        totalTokens,
        totalCost,
        avgResponseTime,
        successRate,
        failedRequests,
        apiErrorRate
      },
      recentActivities,
      systemHealth
    }, { status: 200 });

  } catch (error: any) {
    console.error('Admin stats route error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
