'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/use-auth';
import { 
  Play, Pause, RotateCcw, AlertTriangle, CheckCircle, 
  Terminal, Server, Settings, Cpu, Globe, Search,
  ArrowRight, History, Shield, PlayCircle, Loader2, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AIUsageCenter } from '@/components/dashboard/ai-usage-center';

export default function TestExecutionWorkspace() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Project data states
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [testCases, setTestCaseList] = useState<any[]>([]);
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<string[]>([]);
  const [websiteUrl, setWebsiteUrl] = useState<string>('https://example.com');
  const [browserType, setBrowserType] = useState<'chromium' | 'firefox' | 'webkit' | 'edge'>('chromium');
  const [executionMode, setExecutionMode] = useState<'selected' | 'suite'>('selected');

  // Running execution states
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string>('Pending');
  const [progressLogs, setProgressLogs] = useState<string[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [totalSteps, setTotalSteps] = useState<number>(0);
  
  // Settings Panel Config
  const [retries, setRetries] = useState<number>(3);
  const [aiModel, setAiModel] = useState<string>('deepseek-chat');

  // Queue and Session Diagnostics states
  const [queueList, setQueueList] = useState<any[]>([]);
  const [activeQueueJob, setActiveQueueJob] = useState<any>(null);

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Load projects from API
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects || []);
        }
      } catch (e) {
        console.error('Failed to load projects', e);
      } finally {
        setLoadingProjects(false);
      }
    }
    loadData();
  }, []);

  // Sync test cases when project changes
  useEffect(() => {
    if (selectedProjectId) {
      const proj = projects.find(p => p.id === selectedProjectId);
      if (proj && proj.testCases) {
        const list = proj.testCases.test_cases || [];
        setTestCaseList(list);
        setSelectedTestCaseIds(list.map((tc: any) => tc.test_case_id)); // default all selected
      } else {
        setTestCaseList([]);
        setSelectedTestCaseIds([]);
      }
    } else {
      setTestCaseList([]);
      setSelectedTestCaseIds([]);
    }
  }, [selectedProjectId, projects]);

  // Scroll live logs console
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [progressLogs]);

  // Poll progress status endpoint while running
  useEffect(() => {
    let interval: any;
    if (activeRunId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/execute/progress?runId=${activeRunId}`);
          if (res.ok) {
            const data = await res.json();
            setRunStatus(data.status);
            setProgressLogs(data.progressLogs || []);
            setCurrentStepIndex(data.currentStepIndex || 0);
            setTotalSteps(data.totalSteps || 0);

            if (data.status === 'Completed' || data.status === 'Cancelled') {
              setActiveRunId(null);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [activeRunId]);

  // Poll Queue details
  useEffect(() => {
    const queueInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/execute');
        if (res.ok) {
          const data = await res.json();
          setQueueList(data.queue || []);
          setActiveQueueJob(data.activeJob);
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000);
    return () => clearInterval(queueInterval);
  }, []);

  // Trigger POST execution run
  const getAIHeaders = (): HeadersInit => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (typeof window === "undefined") return headers;
    
    try {
      const providersStr = localStorage.getItem("ai_providers");
      if (!providersStr) return headers;
      
      const parsedProviders = JSON.parse(providersStr);
      const activeProviders = Object.keys(parsedProviders).reduce((acc, key) => {
        acc[key] = { apiKey: parsedProviders[key].apiKey };
        return acc;
      }, {} as Record<string, { apiKey: string }>);

      const defaultModelId = localStorage.getItem("ai_default_model") || "gemini-1.5-flash";
      const modelsStr = localStorage.getItem("ai_models_order");
      let fallbackOrder: string[] = [];
      if (modelsStr) {
        try {
          fallbackOrder = JSON.parse(modelsStr).filter((m: any) => m.enabled).map((m: any) => m.id);
        } catch {}
      }

      const aiConfig = {
        providers: activeProviders,
        fallbackOrder,
        defaultModel: defaultModelId,
      };

      headers["x-ai-config"] = encodeURIComponent(JSON.stringify(aiConfig));
      
      const geminiKey = localStorage.getItem("geminiApiKey") || "";
      if (geminiKey) {
        headers["x-gemini-api-key"] = geminiKey;
      }
    } catch (e) {
      console.error("Failed to build AI headers:", e);
    }

    return headers;
  };

  const handleLaunchExecution = async () => {
    if (!selectedProjectId) {
      alert('Please select a project context.');
      return;
    }

    const tcsToRun = executionMode === 'suite' 
      ? testCases.map(tc => tc.test_case_id) 
      : selectedTestCaseIds;

    if (tcsToRun.length === 0) {
      alert('Please select at least one test case to execute.');
      return;
    }

    setTriggering(true);
    setProgressLogs(['[System] Triggering test execution...']);
    setRunStatus('Pending');
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: getAIHeaders(),
        body: JSON.stringify({
          projectId: selectedProjectId,
          testCaseIds: tcsToRun,
          websiteUrl,
          browser: browserType
        })
      });

      if (res.ok) {
        const data = await res.json();
        setActiveRunId(data.runId);
        setRunStatus(data.status);
      } else {
        const data = await res.json();
        setProgressLogs(prev => [...prev, `[Error] Launch failed: ${data.error || 'Unknown server fault'}`]);
      }
    } catch (e: any) {
      setProgressLogs(prev => [...prev, `[Error] Trigger failed: ${e.message}`]);
    } finally {
      setTriggering(false);
    }
  };

  // Enforce pause/resume/cancel commands
  const handleControlAction = async (action: 'PAUSE' | 'RESUME' | 'CANCEL') => {
    if (!activeRunId) return;
    try {
      const res = await fetch('/api/execute/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: activeRunId, action })
      });
      if (res.ok) {
        const data = await res.json();
        setProgressLogs(prev => [...prev, `[Control] Sent command: ${action}`]);
      } else {
        const err = await res.json();
        alert(err.error || 'Could not send control action.');
      }
    } catch (e) {
      alert('Network error trying to send control action.');
    }
  };

  const handleCheckboxToggle = (tcId: string) => {
    setSelectedTestCaseIds(prev => 
      prev.includes(tcId) ? prev.filter(id => id !== tcId) : [...prev, tcId]
    );
  };

  if (authLoading) return null;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6 pb-20">
      
      {/* Top Breadcrumb Nav Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">AI Agentic Test Execution</h1>
            <p className="text-sm text-slate-500 font-medium">Verify generated test assets using playwrite executors and DeepSeek validator loops.</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <AIUsageCenter />
          <Link href="/dashboard/execution/history">
            <Button variant="outline" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span>Execution History</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COL 1: Run settings & Test select */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center">
                <Globe className="h-4 w-4 mr-2 text-slate-500" />
                Execution Context Settings
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-4 space-y-4 text-xs">
              
              {/* Select Project Context */}
              <div className="space-y-1.5">
                <label className="text-slate-500 font-semibold">Select Target Project</label>
                {loadingProjects ? (
                  <div className="h-9 flex items-center justify-center border border-slate-200 bg-slate-50 rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 outline-none focus:border-slate-300 text-slate-800 font-medium transition-colors"
                  >
                    <option value="">-- Choose project --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.requirementText.slice(0, 50)}...</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Target Website URL */}
              <div className="space-y-1.5">
                <label className="text-slate-500 font-semibold">Target Website URL</label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 outline-none focus:border-slate-300 font-mono text-slate-800"
                />
              </div>

              {/* Dropdown Select Browser */}
              <div className="space-y-1.5">
                <label className="text-slate-500 font-semibold">Target Browser Engine</label>
                <select
                  value={browserType}
                  onChange={(e) => setBrowserType(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 outline-none focus:border-slate-300 text-slate-800 font-medium transition-colors"
                >
                  <option value="chromium">Google Chrome / Chromium</option>
                  <option value="firefox">Mozilla Firefox</option>
                  <option value="webkit">Apple Safari / WebKit</option>
                </select>
              </div>

              {/* Mode Selector */}
              <div className="space-y-1.5">
                <label className="text-slate-500 font-semibold">Execution Mode</label>
                <select
                  value={executionMode}
                  onChange={(e) => setExecutionMode(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 outline-none focus:border-slate-300 text-slate-800 font-medium transition-colors"
                >
                  <option value="selected">Execute Selected Test Cases</option>
                  <option value="suite">Execute Entire Test Suite</option>
                </select>
              </div>

              {/* Execution Actions Button */}
              {activeRunId ? (
                <div className="pt-2 grid grid-cols-3 gap-2">
                  {runStatus === 'Paused' ? (
                    <Button 
                      onClick={() => handleControlAction('RESUME')} 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg"
                    >
                      <Play className="h-3 w-3" /> Resume
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handleControlAction('PAUSE')} 
                      className="bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg"
                    >
                      <Pause className="h-3 w-3" /> Pause
                    </Button>
                  )}
                  <Button 
                    onClick={() => handleControlAction('CANCEL')} 
                    className="col-span-2 bg-red-600 hover:bg-red-700 text-white font-bold flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg"
                  >
                    Cancel Run
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleLaunchExecution}
                  disabled={triggering || !selectedProjectId}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 mt-4 text-xs transition-colors"
                >
                  {triggering ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Triggering...</span>
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4" />
                      <span>Execute Test Cases</span>
                    </>
                  )}
                </Button>
              )}

            </CardContent>
          </Card>

          {/* Test cases list checklist */}
          {selectedProjectId && testCases.length > 0 && executionMode === 'selected' && (
            <Card className="border-slate-200 bg-white shadow-sm overflow-hidden transition-all duration-300">
              <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/30">
                <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Test Cases ({selectedTestCaseIds.length}/{testCases.length})</CardTitle>
              </CardHeader>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-2 text-xs">
                {testCases.map((tc: any) => {
                  const isChecked = selectedTestCaseIds.includes(tc.test_case_id);
                  return (
                    <label key={tc.test_case_id} className="flex items-start space-x-3 p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-all">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleCheckboxToggle(tc.test_case_id)}
                        className="mt-0.5 border-slate-200 rounded text-slate-900 focus:ring-slate-400"
                      />
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{tc.test_case_id}</span>
                        <span className="text-slate-500 text-[10px] mt-0.5 line-clamp-2">{tc.summary || tc.title}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* COL 2 & 3: Console Logs & Live Console Panels */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Live Progress Bar and Controller */}
          {activeRunId && (
            <Card className="border-slate-200 bg-white shadow-sm p-5 space-y-4">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-800">Runner Status:</span>
                  <span className={`px-2 py-0.5 rounded font-bold border text-[10px] uppercase ${
                    runStatus === 'Running' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                    runStatus === 'Paused' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                    'bg-slate-100 text-slate-800 border-slate-200'
                  }`}>
                    {runStatus}
                  </span>
                </div>
                <span className="font-mono text-slate-500 font-semibold">{currentStepIndex} / {totalSteps} steps completed</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div 
                  className="bg-slate-900 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${totalSteps > 0 ? (currentStepIndex / totalSteps) * 100 : 0}%` }}
                ></div>
              </div>
            </Card>
          )}

          {/* Live execution streamer logs console */}
          <Card className="border-slate-200 bg-white shadow-sm flex flex-col h-[400px]">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center">
                  <Terminal className="h-4 w-4 mr-2 text-slate-500" />
                  Live Execution Console Streamer
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">Real-time validation events feed</CardDescription>
              </div>
              {activeRunId && (
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping"></span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase font-mono">streaming...</span>
                </div>
              )}
            </CardHeader>

            <div className="flex-1 bg-slate-950 p-4 font-mono text-[11px] text-slate-300 overflow-y-auto space-y-1.5 rounded-b-lg border-t border-slate-900">
              {progressLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                  <Terminal className="h-8 w-8 text-slate-800" />
                  <span>Terminal idle. Start a new execution context to stream logs.</span>
                </div>
              ) : (
                progressLogs.map((log, idx) => (
                  <div key={idx} className={
                    log.includes('[Error]') ? 'text-red-400' :
                    log.includes('[Control]') ? 'text-amber-400' :
                    log.includes('🚀') ? 'text-cyan-400 font-bold' :
                    log.includes('✓') || log.includes('[Passed]') ? 'text-green-400' :
                    log.includes('[System]') ? 'text-indigo-400' : 'text-slate-300'
                  }>
                    {log}
                  </div>
                ))
              )}
              <div ref={logEndRef}></div>
            </div>
          </Card>

          {/* Diagnostics grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Active Execution Queue */}
            <Card className="border-slate-200 bg-white shadow-sm p-5 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                <Server className="h-4 w-4 text-slate-500" />
                <h4 className="font-bold text-xs text-slate-900 uppercase">Execution Worker Queue</h4>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-500 font-semibold border-b border-slate-50 pb-1">
                  <span>Queued Jobs</span>
                  <span>{queueList.length} total</span>
                </div>
                {queueList.length === 0 && !activeQueueJob ? (
                  <div className="text-slate-400 font-medium italic text-center py-4">Queue is empty. Worker is idle.</div>
                ) : (
                  <div className="space-y-1.5 font-mono text-[10px] text-slate-700 max-h-36 overflow-y-auto">
                    {activeQueueJob && (
                      <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-2 rounded">
                        <span className="font-bold text-blue-800">RUNNING: {activeQueueJob.runId.slice(0, 8)}...</span>
                        <span className="bg-blue-100 text-blue-700 px-1 rounded text-[9px] uppercase font-bold">{activeQueueJob.browser}</span>
                      </div>
                    )}
                    {queueList.map((job, idx) => (
                      <div key={job.runId} className="flex items-center justify-between bg-slate-50 border border-slate-100 p-2 rounded">
                        <span className="font-medium text-slate-700">#{idx + 1}: {job.runId.slice(0, 8)}...</span>
                        <span className="bg-slate-200 text-slate-600 px-1 rounded text-[9px] uppercase font-bold">{job.browser}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Execution Configurations and Toggles */}
            <Card className="border-slate-200 bg-white shadow-sm p-5 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                <Settings className="h-4 w-4 text-slate-500" />
                <h4 className="font-bold text-xs text-slate-900 uppercase">Automation Rules</h4>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-semibold">AI Validation Model</span>
                  <select 
                    value={aiModel} 
                    onChange={(e) => setAiModel(e.target.value)}
                    className="border border-slate-200 rounded p-1 outline-none text-slate-800 focus:border-slate-300 font-mono text-[11px]"
                  >
                    <option value="deepseek-chat">deepseek-chat (Default)</option>
                    <option value="deepseek-reasoner">deepseek-reasoner</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash (Fallback)</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-semibold">Retry Threshold limit</span>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={retries}
                    onChange={(e) => setRetries(parseInt(e.target.value))}
                    className="w-16 border border-slate-200 rounded text-center p-0.5 outline-none font-mono text-[11px]"
                  />
                </div>
                <div className="flex justify-between items-center border-t border-slate-50 pt-2">
                  <span className="text-slate-500 font-semibold">Selector strategies</span>
                  <span className="font-mono text-[9px] text-slate-600 font-bold bg-slate-100 px-1.5 py-0.5 border border-slate-200 rounded">
                    data-testid ➔ aria-label ➔ id
                  </span>
                </div>
              </div>
            </Card>

          </div>

        </div>

      </div>

    </div>
  );
}
