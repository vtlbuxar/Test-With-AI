'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';

const verifySchema = z.object({
  code: z.string().length(6, 'Please enter the complete 6-digit code'),
});

type VerifyFormValues = z.infer<typeof verifySchema>;

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema),
  });

  const onSubmit = async (data: VerifyFormValues) => {
    setIsLoading(true);
    setServerError('');
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: data.code }),
      });
      const result = await response.json();
      if (!response.ok) {
        setServerError(result.error || 'Invalid or expired verification code. Please try again.');
      } else {
        router.push('/login?verified=true');
      }
    } catch {
      setServerError('Unable to connect to the server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!email) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Invalid verification link</h2>
        <p className="text-sm text-gray-500 mb-6">No email address was provided for verification.</p>
        <Link href="/signup" className="text-sm font-medium text-gray-900 hover:underline underline-offset-4">
          &larr; Back to sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
      {/* Icon + header */}
      <div className="mb-7">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Check your inbox</h1>
        <p className="text-sm text-gray-500 mt-1.5">
          We sent a 6-digit verification code to{' '}
          <span className="font-medium text-gray-700">{email}</span>
        </p>
      </div>

      {/* Server error */}
      {serverError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3.5 mb-5" role="alert">
          <svg className="flex-shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1.5">
            Verification Code
          </label>
          <input
            {...register('code')}
            id="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            disabled={isLoading}
            className={`w-full px-4 py-3 text-xl font-semibold tracking-[0.4em] text-center rounded-lg border bg-white text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-400 ${errors.code ? 'border-red-400 bg-red-50/30' : 'border-gray-300'}`}
          />
          {errors.code && <p className="mt-1.5 text-xs text-red-600 text-center">{errors.code.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          id="verify-btn"
          className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading && <SpinnerIcon />}
          {isLoading ? 'Verifying...' : 'Verify Email'}
        </button>
      </form>

      <div className="mt-6 text-center space-y-3">
        <p className="text-sm text-gray-500">
          Didn't receive the code?{' '}
          <button
            type="button"
            className="font-medium text-gray-900 hover:underline underline-offset-4 transition-colors"
            onClick={() => setServerError('')}
          >
            Resend code
          </button>
        </p>
        <p className="text-sm">
          <Link href="/signup" className="text-gray-500 hover:text-gray-700 transition-colors">
            &larr; Back to sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <SpinnerIcon />
          Loading...
        </div>
      </div>
    }>
      <VerifyForm />
    </Suspense>
  );
}

