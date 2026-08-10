'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

const forgotSchema = z.object({
  resetEmail: z.string().email('Please enter a valid email address'),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type ForgotFormValues = z.infer<typeof forgotSchema>;

// ─── Icons ────────────────────────────────────────────────────────────────────

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get('verified') === 'true';

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const { register: registerForgot, handleSubmit: handleForgotSubmit, formState: { errors: forgotErrors } } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setServerError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setServerError(result.error || 'Incorrect email or password. Please try again.');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setServerError('Unable to connect to the server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onForgotSubmit = async (data: ForgotFormValues) => {
    setForgotLoading(true);
    setForgotError('');
    try {
      // UI-only: simulate sending reset link
      await new Promise(r => setTimeout(r, 1000));
      setForgotSent(true);
    } catch {
      setForgotError('Unable to send reset email. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  // ── Forgot Password View ──
  if (showForgot) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
        {forgotSent ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h2>
            <p className="text-sm text-gray-500 mb-6">If an account exists, we've sent a password reset link to that address.</p>
            <button
              onClick={() => { setShowForgot(false); setForgotSent(false); }}
              className="text-sm font-medium text-gray-700 hover:text-gray-900 underline-offset-4 hover:underline transition-colors"
            >
              &larr; Back to login
            </button>
          </div>
        ) : (
          <>
            <div className="mb-7">
              <h1 className="text-xl font-semibold text-gray-900">Reset your password</h1>
              <p className="text-sm text-gray-500 mt-1.5">Enter your email and we'll send you a reset link.</p>
            </div>

            {forgotError && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3.5 mb-5">
                <svg className="flex-shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p className="text-sm text-red-700">{forgotError}</p>
              </div>
            )}

            <form onSubmit={handleForgotSubmit(onForgotSubmit)} className="space-y-5">
              <div>
                <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email address
                </label>
                <input
                  {...registerForgot('resetEmail')}
                  id="resetEmail"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className={`w-full px-3.5 py-2.5 text-sm rounded-lg border bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all ${forgotErrors.resetEmail ? 'border-red-400 bg-red-50/30' : 'border-gray-300'}`}
                />
                {forgotErrors.resetEmail && (
                  <p className="mt-1.5 text-xs text-red-600">{forgotErrors.resetEmail.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {forgotLoading && <SpinnerIcon />}
                {forgotLoading ? 'Sending link...' : 'Send Reset Link'}
              </button>
            </form>

            <button
              onClick={() => setShowForgot(false)}
              className="mt-5 w-full text-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              &larr; Back to login
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Login View ──
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-gray-900">Welcome back</h1>
        <p className="text-sm text-gray-500 mt-1.5">Sign in to your account to continue.</p>
      </div>

      {/* Verified success banner */}
      {verified && !serverError && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3.5 mb-5">
          <svg className="flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <p className="text-sm text-green-700">Email verified successfully. You can now sign in.</p>
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3.5 mb-5" role="alert">
          <svg className="flex-shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
            Email address
          </label>
          <input
            {...register('email')}
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            disabled={isLoading}
            className={`w-full px-3.5 py-2.5 text-sm rounded-lg border bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-400 ${errors.email ? 'border-red-400 bg-red-50/30' : 'border-gray-300'}`}
          />
          {errors.email && <p className="mt-1.5 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-xs text-gray-500 hover:text-gray-800 transition-colors underline-offset-4 hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              {...register('password')}
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={isLoading}
              className={`w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg border bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-400 ${errors.password ? 'border-red-400 bg-red-50/30' : 'border-gray-300'}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {errors.password && <p className="mt-1.5 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2.5">
          <input
            {...register('rememberMe')}
            id="rememberMe"
            type="checkbox"
            className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
          />
          <label htmlFor="rememberMe" className="text-sm text-gray-600 cursor-pointer select-none">
            Keep me signed in
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-1"
        >
          {isLoading && <SpinnerIcon />}
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don't have an account?{' '}
        <a href="/signup" className="font-medium text-gray-900 hover:underline underline-offset-4 transition-colors">
          Create account
        </a>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <SpinnerIcon />
          Loading...
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}


