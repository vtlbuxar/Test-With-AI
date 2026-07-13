'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const verifySchema = z.object({
  code: z.string().length(6, 'Verification code must be exactly 6 digits'),
});

type VerifyFormValues = z.infer<typeof verifySchema>;

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema)
  });

  const onSubmit = async (data: VerifyFormValues) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: data.code }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Invalid verification code');
      } else {
        router.push('/login?verified=true');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!email) {
    return (
      <div className="text-center">
        <p className="text-red-500">No email provided for verification.</p>
        <button onClick={() => router.push('/signup')} className="mt-4 text-blue-600 hover:underline">
          Go back to signup
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verify your email</h1>
        <p className="text-gray-500 dark:text-zinc-400 mt-2 text-sm">
          We sent a 6-digit code to <span className="font-medium text-gray-700 dark:text-zinc-300">{email}</span>
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Verification Code</label>
          <input
            {...register('code')}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-center tracking-[0.5em] text-lg font-semibold"
            placeholder="000000"
            maxLength={6}
          />
          {errors.code && <p className="text-red-500 text-xs mt-1 text-center">{errors.code.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-70"
        >
          {isLoading ? 'Verifying...' : 'Verify'}
        </button>
      </form>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="text-center p-8">Loading...</div>}>
      <VerifyForm />
    </Suspense>
  );
}
