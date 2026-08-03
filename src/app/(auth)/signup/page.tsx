'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';

// Schema

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits'),
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['Analyst', 'User'], { message: 'Please select a role' }),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  terms: z.boolean().refine(val => val === true, { message: 'You must accept the terms to continue' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignupFormValues = z.infer<typeof signupSchema>;

// Icons

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

// Password helpers

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 1) return { score, label: 'Weak', color: '#dc2626' };
  if (score === 2) return { score, label: 'Fair', color: '#f59e0b' };
  if (score === 3) return { score, label: 'Good', color: '#2563eb' };
  return { score, label: 'Strong', color: '#16a34a' };
}

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs transition-colors ${met ? 'text-green-600' : 'text-gray-400'}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {met ? <polyline points="20 6 9 17 4 12"/> : <circle cx="12" cy="12" r="10"/>}
      </svg>
      {text}
    </div>
  );
}

// Main component

export default function SignupPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');

  const { register, handleSubmit, watch, formState: { errors } } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { role: 'Analyst', terms: false },
  });

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordValue(e.target.value);
  }, []);

  const strength = getPasswordStrength(passwordValue);
  const pwd = passwordValue;

  const requirements = [
    { met: pwd.length >= 8, text: '8+ characters' },
    { met: /[A-Z]/.test(pwd), text: 'Uppercase letter' },
    { met: /[a-z]/.test(pwd), text: 'Lowercase letter' },
    { met: /[0-9]/.test(pwd), text: 'Number' },
    { met: /[^A-Za-z0-9]/.test(pwd), text: 'Special character' },
  ];

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);
    setServerError('');
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
        setServerError(result.error || 'Something went wrong. Please try again.');
      } else {
        router.push(`/verify?email=${encodeURIComponent(data.email)}`);
      }
    } catch {
      setServerError('Unable to connect to the server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full px-3.5 py-2.5 text-sm rounded-lg border bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-400 ${hasError ? 'border-red-400 bg-red-50/30' : 'border-gray-300'}`;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-gray-900">Create your account</h1>
        <p className="text-sm text-gray-500 mt-1.5">Get started with AI Test Analyst - free.</p>
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
          <input
            {...register('name')}
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Jane Smith"
            disabled={isLoading}
            className={inputClass(!!errors.name)}
          />
          {errors.name && <p className="mt-1.5 text-xs text-red-600">{errors.name.message}</p>}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
          <input
            {...register('phoneNumber')}
            id="phoneNumber"
            type="tel"
            autoComplete="tel"
            placeholder="+1 (555) 000-0000"
            disabled={isLoading}
            className={inputClass(!!errors.phoneNumber)}
          />
          {errors.phoneNumber && <p className="mt-1.5 text-xs text-red-600">{errors.phoneNumber.message}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
          <input
            {...register('email')}
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            disabled={isLoading}
            className={inputClass(!!errors.email)}
          />
          {errors.email && <p className="mt-1.5 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        {/* Role */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
          <select
            {...register('role')}
            id="role"
            disabled={isLoading}
            className={inputClass(!!errors.role)}
          >
            <option value="Analyst">Analyst</option>
          </select>
          {errors.role && <p className="mt-1.5 text-xs text-red-600">{errors.role.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
          <div className="relative">
            <input
              {...register('password', {
                onChange: handlePasswordChange,
              })}
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              disabled={isLoading}
              className={inputClass(!!errors.password) + ' pr-10'}
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

          {/* Strength meter */}
          {passwordValue && (
            <div className="mt-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{ backgroundColor: i <= Math.ceil(strength.score * 4 / 5) ? strength.color : '#e5e7eb' }}
                    />
                  ))}
                </div>
                {strength.label && (
                  <span className="text-xs font-medium" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {requirements.map((req) => (
                  <PasswordRequirement key={req.text} met={req.met} text={req.text} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
          <div className="relative">
            <input
              {...register('confirmPassword')}
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              disabled={isLoading}
              className={inputClass(!!errors.confirmPassword) + ' pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {errors.confirmPassword && <p className="mt-1.5 text-xs text-red-600">{errors.confirmPassword.message}</p>}
        </div>

        {/* Terms */}
        <div>
          <div className="flex items-start gap-2.5">
            <input
              {...register('terms')}
              id="terms"
              type="checkbox"
              disabled={isLoading}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer flex-shrink-0"
            />
            <label htmlFor="terms" className="text-sm text-gray-600 cursor-pointer leading-snug">
              I agree to the{' '}
              <a href="#" className="text-gray-900 font-medium hover:underline underline-offset-4">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-gray-900 font-medium hover:underline underline-offset-4">Privacy Policy</a>
            </label>
          </div>
          {errors.terms && <p className="mt-1.5 text-xs text-red-600">{errors.terms.message}</p>}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-1"
        >
          {isLoading && <SpinnerIcon />}
          {isLoading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <a href="/login" className="font-medium text-gray-900 hover:underline underline-offset-4 transition-colors">
          Sign in
        </a>
      </p>
    </div>
  );
}
