import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f7f8fa]">
      {/* Minimal top bar */}
      <header className="w-full px-6 py-5 flex items-center justify-center border-b border-gray-200 bg-white">
        <a href="/welcome" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 2L15.5 5.5V12.5L9 16L2.5 12.5V5.5L9 2Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="9" cy="9" r="2.5" fill="white"/>
            </svg>
          </div>
          <span className="font-semibold text-gray-900 text-[15px] tracking-tight">AI Test Analyst</span>
        </a>
      </header>

      {/* Center content */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px]">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-6 py-4 flex items-center justify-center gap-6 border-t border-gray-200 bg-white">
        <span className="text-xs text-gray-400">© 2025 AI Test Analyst</span>
        <a href="/welcome" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Home</a>
        <a href="#" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Privacy</a>
        <a href="#" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Terms</a>
      </footer>
    </div>
  );
}

