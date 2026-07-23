import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import { z } from 'zod';

const resend = new Resend(process.env.RESEND_API_KEY || 're_fallback');

const signupSchema = z.object({
  name: z.string().min(2),
  phoneNumber: z.string().min(10),
  email: z.string().email(),
  role: z.enum(['Analyst', 'User']),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate input
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const { name, phoneNumber, email, role, password } = parsed.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    // Create user in DB
    const user = await prisma.user.create({
      data: {
        name,
        phoneNumber,
        email,
        role,
        passwordHash,
        verificationCode,
        verificationCodeExpiry,
        isVerified: false,
      },
    });

    // Send email using Resend
    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'onboarding@resend.dev', // Default resend testing email
        to: email,
        subject: 'Your Authentication Code',
        html: `<p>Hi ${name},</p><p>Your verification code is: <strong>${verificationCode}</strong></p><p>This code will expire in 15 minutes.</p>`,
      });
    } else {
      console.log(`[MOCK EMAIL] To: ${email}, Code: ${verificationCode}`);
    }

    return NextResponse.json({ message: 'User created successfully. Please verify your email.' }, { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
