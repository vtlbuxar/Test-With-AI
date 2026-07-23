import Link from 'next/link';
import { ArrowRight, ShieldCheck, Zap, BrainCircuit } from 'lucide-react';

export default function WelcomePage() {
  return (
    <div className="flex-1 bg-white dark:bg-zinc-950 flex flex-col relative overflow-hidden min-h-screen">
      {/* Background decoration */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-900/10 pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 -left-40 w-72 h-72 bg-purple-400/10 dark:bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Navigation Bar */}
      <nav className="relative z-10 w-full px-6 md:px-12 py-6 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-500/20">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <span className="font-bold text-2xl tracking-tight text-gray-900 dark:text-white">
            AI Test Analyst
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link 
            href="/login" 
            className="text-sm font-semibold text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            Log In
          </Link>
          <Link 
            href="/signup" 
            className="text-sm font-semibold bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 px-5 py-2.5 rounded-full transition-all shadow-sm hover:shadow"
          >
            Sign Up
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center items-center text-center px-6 py-20 relative z-10 max-w-4xl mx-auto mt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-semibold mb-8 border border-blue-100 dark:border-blue-800/50">
          <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
          Intelligent Test Generation
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6 leading-tight">
          Supercharge your <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
            testing workflows
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-gray-600 dark:text-zinc-400 mb-10 max-w-2xl leading-relaxed">
          AI Test Analyst helps you generate, analyze, and manage test suites with the power of artificial intelligence. Streamline your QA process in minutes.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link 
            href="/signup" 
            className="w-full sm:w-auto group relative flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-3.5 rounded-full font-medium transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link 
            href="/login" 
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-900 dark:text-white border border-gray-200 dark:border-zinc-800 px-8 py-3.5 rounded-full font-medium transition-all shadow-sm"
          >
            Log in to account
          </Link>
        </div>

        {/* Feature Highlights */}
        <div className="grid md:grid-cols-3 gap-8 mt-28 text-left w-full border-t border-gray-100 dark:border-zinc-800 pt-16">
          <div className="flex flex-col gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-1">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Lightning Fast</h3>
            <p className="text-gray-500 dark:text-zinc-400 text-sm leading-relaxed">
              Generate comprehensive test suites in seconds instead of hours using advanced AI models.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-1">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">AI-Powered Analysis</h3>
            <p className="text-gray-500 dark:text-zinc-400 text-sm leading-relaxed">
              Upload your requirements and let our models understand the context automatically.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 mb-1">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Secure & Reliable</h3>
            <p className="text-gray-500 dark:text-zinc-400 text-sm leading-relaxed">
              Your data is securely processed. Export test results with complete confidence.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
