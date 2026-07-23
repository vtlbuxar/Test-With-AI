'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['Analyst', 'User'], { message: 'Please select a role' }),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      role: 'User'
    }
  });

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          phoneNumber: data.phoneNumber,
          email: data.email,
          role: data.role,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Something went wrong');
      } else {
        router.push(`/verify?email=${encodeURIComponent(data.email)}`);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create an Account</h1>
        <p className="text-gray-500 dark:text-zinc-400 mt-2 text-sm">Sign up to get started</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Name</label>
          <input
            {...register('name')}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="John Doe"
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Phone Number</label>
          <input
            {...register('phoneNumber')}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="+1 (555) 000-0000"
          />
          {errors.phoneNumber && <p className="text-red-500 text-xs mt-1">{errors.phoneNumber.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Email</label>
          <input
            {...register('email')}
            type="email"
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="john@example.com"
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Role</label>
          <select
            {...register('role')}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          >
            <option value="User">User</option>
            <option value="Analyst">Analyst</option>
          </select>
          {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Password</label>
          <input
            {...register('password')}
            type="password"
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="••••••••"
          />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Confirm Password</label>
          <input
            {...register('confirmPassword')}
            type="password"
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="••••••••"
          />
          {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-70"
        >
          {isLoading ? 'Creating account...' : 'Sign Up'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-zinc-400">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-600 hover:text-blue-500 font-medium">
          Log in
        </Link>
      </p>
    </div>
  );
}
