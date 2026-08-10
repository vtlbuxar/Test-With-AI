import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session: any = await getSession();

    if (!session || !session.userId) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      response.cookies.delete('auth_token');
      return response;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phoneNumber: true,
        status: true,
        createdAt: true,
      }
    });

    if (!user) {
      const response = NextResponse.json({ error: 'User not found' }, { status: 404 });
      response.cookies.delete('auth_token');
      return response;
    }

    if (user.status === 'SUSPENDED') {
      const response = NextResponse.json({ error: 'Account suspended' }, { status: 403 });
      response.cookies.delete('auth_token');
      return response;
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error('Me route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
