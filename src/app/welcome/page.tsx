export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <nav className="w-full border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="/welcome" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 2L15.5 5.5V12.5L9 16L2.5 12.5V5.5L9 2Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="9" cy="9" r="2.5" fill="white" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-[15px] tracking-tight">AI Test Analyst</span>
          </a>

          {/* Nav links */}
          <div className="flex items-center gap-1">
            <a
              href="/login"
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Sign in
            </a>
            <a
              href="/signup"
              className="px-4 py-2 text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors"
            >
              Get started
            </a>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-6xl w-full mx-auto grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          {/* Left â€” hero copy */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600 text-xs font-medium mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
              Intelligent QA Automation
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-6">
              AI-powered testing,<br />
              <span className="text-gray-500">built for your team</span>
            </h1>

            <p className="text-lg text-gray-500 leading-relaxed mb-10 max-w-md">
              Generate comprehensive test suites, analyze requirements, and manage defects - all in one intelligent platform.
            </p>

            {/* Feature list */}
            <ul className="space-y-3 mb-10">
              {[
                'Generate test cases from requirements in seconds',
                'Multi-model AI with automatic failover',
                'Export to PDF, Excel, and Jira-ready formats',
                'Role-based access for teams',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm text-gray-600">
                  <svg className="flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            {/* CTA buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/signup"
                className="flex items-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-medium text-sm rounded-lg transition-colors"
              >
                Sign up to account
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
              <a
                href="/login"
                className="flex items-center gap-2 px-6 py-3 border border-gray-300 hover:border-gray-400 text-gray-700 font-medium text-sm rounded-lg transition-colors bg-white hover:bg-gray-50"
              >
                Sign in to account
              </a>
            </div>

            {/* Trust line */}
            <p className="mt-8 text-xs text-gray-400">
              No credit card required &bull; Cancel anytime
            </p>
          </div>

          {/* Right â€” feature cards */}
          <div className="hidden lg:flex flex-col gap-4">
            {/* Card 1 */}
            <div className="border border-gray-200 rounded-xl p-6 bg-white hover:border-gray-300 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                    <polyline points="13 2 13 9 20 9" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Requirement Analysis</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">Upload documents or paste text. AI extracts testable requirements and generates structured test cases automatically.</p>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="border border-gray-200 rounded-xl p-6 bg-white hover:border-gray-300 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4l3 3" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Smart Fallback Engine</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">Configure Gemini, Claude, GPT-4, Groq, and more. If one model fails, the platform silently switches to the next.</p>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="border border-gray-200 rounded-xl p-6 bg-white hover:border-gray-300 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Defect & RTM Tracking</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">Generate defect reports and Requirements Traceability Matrices. Link every test case back to its requirement.</p>
                </div>
              </div>
            </div>

            {/* Bottom stat strip */}
            <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 flex items-center justify-between">
              {[
                { value: '10x', label: 'Faster QA cycles' },
                { value: '6+', label: 'AI providers' },
                { value: '100%', label: 'Data privacy' },
              ].map((stat, i) => (
                <div key={i} className={`text-center flex-1 ${i < 2 ? 'border-r border-gray-200' : ''}`}>
                  <div className="text-xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400">&copy; 2025 AI Test Analyst. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <a href="#" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Privacy Policy</a>
            <a href="#" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Terms of Service</a>
            <a href="#" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

