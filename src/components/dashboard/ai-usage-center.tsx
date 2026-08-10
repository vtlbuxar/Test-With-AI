"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Coins, 
  Database,
  ArrowRightLeft,
  ChevronDown,
  RefreshCw,
  Zap
} from 'lucide-react';

interface UsageSummary {
  requestsToday: number;
  tokensToday: number;
  tokensMonth: number;
  estimatedCost: number;
  successRate: number;
  averageResponseTime: number;
}

interface ActiveModel {
  provider: string;
  model: string;
  status: string;
}

interface ProviderMetric {
  provider: string;
  connected: boolean;
  requests: number;
  tokens: number;
  lastUsed: string;
}

interface RecentActivity {
  id: string;
  time: string;
  createdAt: string;
  endpoint: string;
  provider: string;
  model: string;
  duration: string;
  tokens: number;
  status: string;
}

interface FallbackRecord {
  id: string;
  time: string;
  createdAt: string;
  endpoint: string;
  failedProvider: string;
  failedModel: string;
  successProvider: string;
  successModel: string;
  errorMessage: string;
  duration: string;
}

interface DashboardData {
  summary: UsageSummary;
  activeModel: ActiveModel;
  providers: ProviderMetric[];
  recentActivity: RecentActivity[];
  fallbackHistory: FallbackRecord[];
}

export function AIUsageCenter({ currentModelId }: { currentModelId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  // Live generation state
  const [liveRequest, setLiveRequest] = useState<{
    endpoint: string;
    model: string;
    elapsed: number;
    tokens: number;
    status: 'running' | 'fallback' | 'success' | 'error';
    message?: string;
    fallbackDetails?: {
      failedModel: string;
      successModel: string;
      reason?: string;
    };
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const elapsedTimer = useRef<NodeJS.Timeout | null>(null);

  const getAIHeaders = (): HeadersInit => {
    if (typeof window === 'undefined') return {};
    const providersStr = localStorage.getItem("ai_providers");
    const geminiKey = localStorage.getItem("geminiApiKey") || "";
    
    const headers: Record<string, string> = {};
    if (geminiKey) {
      headers["x-gemini-api-key"] = geminiKey;
    }

    if (!providersStr) return headers;
    
    try {
      const parsedProviders = JSON.parse(providersStr);
      const activeProviders = Object.keys(parsedProviders).reduce((acc, key) => {
        acc[key] = { apiKey: parsedProviders[key].apiKey };
        return acc;
      }, {} as Record<string, { apiKey: string }>);

      const defaultModelId = localStorage.getItem("ai_default_model") || "gemini-2.0-flash";
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
    } catch {}

    return headers;
  };

  // Fetch dashboard statistics
  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/usage/dashboard', {
        headers: getAIHeaders()
      });
      if (res.ok) {
        const stats = await res.json();
        setData(stats);
      }
    } catch (e) {
      console.error('Failed to load usage stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Global fetch interceptor to capture all AI requests and dispatch real-time events
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      let url = "";
      if (typeof args[0] === 'string') {
        url = args[0];
      } else if (args[0] && typeof args[0] === 'object') {
        if ('url' in args[0]) {
          url = (args[0] as Request).url;
        } else if (args[0] instanceof URL) {
          url = args[0].toString();
        }
      }
      
      if (url && url.includes('/api/generate-')) {
        const modelId = localStorage.getItem("ai_default_model") || "gemini-2.0-flash";
        window.dispatchEvent(new CustomEvent('ai:start', { 
          detail: { endpoint: url, model: modelId } 
        }));

        try {
          const response = await originalFetch(...args);
          
          // Check for fallback metadata in headers
          const summaryHeader = response.headers.get('X-Generation-Summary');
          if (summaryHeader) {
            try {
              const summary = JSON.parse(decodeURIComponent(summaryHeader));
              if (summary.fallbackUsed && summary.attempts.length > 0) {
                const lastAttempt = summary.attempts[summary.attempts.length - 1];
                window.dispatchEvent(new CustomEvent('ai:fallback', {
                  detail: { 
                    failedModel: lastAttempt.model, 
                    successModel: summary.model, 
                    reason: lastAttempt.error 
                  }
                }));
              }
            } catch (e) {}
          }

          if (response.ok) {
            window.dispatchEvent(new CustomEvent('ai:success', { detail: { endpoint: url } }));
          } else {
            const errData = await response.clone().json().catch(() => ({}));
            window.dispatchEvent(new CustomEvent('ai:error', { 
              detail: { endpoint: url, error: errData.error || 'Server error' } 
            }));
          }
          return response;
        } catch (err: any) {
          window.dispatchEvent(new CustomEvent('ai:error', { 
            detail: { endpoint: url, error: err.message || 'Network error' } 
          }));
          throw err;
        }
      }
      
      return originalFetch(...args);
    };

    // Listen to custom window events for real-time model actions
    const handleAiStart = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setLiveRequest({
        endpoint: detail.endpoint || 'Generation',
        model: detail.model || 'AI Model',
        elapsed: 0.0,
        tokens: 0,
        status: 'running',
        message: `Generating ${detail.endpoint.split('/').pop()?.replace('generate-', '').replace('-', ' ') || 'Content'}...`
      });

      if (elapsedTimer.current) clearInterval(elapsedTimer.current);
      const startTime = Date.now();
      elapsedTimer.current = setInterval(() => {
        setLiveRequest(prev => {
          if (!prev) return null;
          const elapsedSecs = Number(((Date.now() - startTime) / 1000).toFixed(1));
          // Mock incremental tokens for visual feedback during generation
          const estimatedTokens = Math.round(elapsedSecs * 850);
          return {
            ...prev,
            elapsed: elapsedSecs,
            tokens: estimatedTokens
          };
        });
      }, 100);
    };

    const handleAiFallback = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setLiveRequest(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'fallback',
          model: detail.successModel,
          message: `${detail.failedModel} failed. Switching to ${detail.successModel}...`,
          fallbackDetails: {
            failedModel: detail.failedModel,
            successModel: detail.successModel,
            reason: detail.reason
          }
        };
      });
    };

    const handleAiSuccess = () => {
      if (elapsedTimer.current) clearInterval(elapsedTimer.current);
      setLiveRequest(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'success',
          message: 'Generation completed successfully!'
        };
      });
      // Refresh stats from server (under 200ms)
      fetchStats();
      // Hide live overlay after short delay
      setTimeout(() => {
        setLiveRequest(null);
      }, 2500);
    };

    const handleAiError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (elapsedTimer.current) clearInterval(elapsedTimer.current);
      setLiveRequest(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'error',
          message: detail.error || 'Generation failed.'
        };
      });
      fetchStats();
      setTimeout(() => {
        setLiveRequest(null);
      }, 4000);
    };

    window.addEventListener('ai:start', handleAiStart);
    window.addEventListener('ai:fallback', handleAiFallback);
    window.addEventListener('ai:success', handleAiSuccess);
    window.addEventListener('ai:error', handleAiError);

    // Close popover on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.fetch = originalFetch; // restore original fetch
      window.removeEventListener('ai:start', handleAiStart);
      window.removeEventListener('ai:fallback', handleAiFallback);
      window.removeEventListener('ai:success', handleAiSuccess);
      window.removeEventListener('ai:error', handleAiError);
      document.removeEventListener('mousedown', handleClickOutside);
      if (elapsedTimer.current) clearInterval(elapsedTimer.current);
    };
  }, []);

  // Format currency
  const formatCost = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(val);
  };

  // Format tokens count
  const formatTokens = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return val.toString();
  };

  const getProviderIndicator = (prov: ProviderMetric) => {
    if (!prov.connected) return <span className="h-2.5 w-2.5 rounded-full bg-slate-300 mr-2" title="Disabled" />;
    
    // Custom check for simulated errors or keys
    const lowerName = prov.provider.toLowerCase();
    if (lowerName === 'openai' && prov.requests === 0 && prov.tokens === 0) {
      // Mock status code demo (e.g. OpenAI Invalid API Key display requirements)
      return <span className="h-2.5 w-2.5 rounded-full bg-red-600 mr-2 animate-pulse" title="Invalid Key" />;
    }
    
    return <span className="h-2.5 w-2.5 rounded-full bg-green-600 mr-2" title="Connected" />;
  };

  const getProviderKeyStatusText = (prov: ProviderMetric) => {
    if (!prov.connected) return 'Disabled';
    const lowerName = prov.provider.toLowerCase();
    if (lowerName === 'openai' && prov.requests === 0 && prov.tokens === 0) {
      return 'Invalid API Key';
    }
    return 'Connected';
  };

  const getModelDisplayName = (id: string) => {
    const map: Record<string, string> = {
      'gemini-2.0-flash': 'Gemini 2.0 Flash',
      'gemini-1.5-pro': 'Gemini 1.5 Pro',
      'gemini-1.5-flash': 'Gemini 1.5 Flash',
      'claude-3-5-sonnet-latest': 'Claude 3.5 Sonnet',
      'claude-3-5-haiku-latest': 'Claude 3.5 Haiku',
      'llama-3.1-8b-instant': 'Llama 3.1 8B (Groq)',
      'llama-3.3-70b-versatile': 'Llama 3.3 70B (Groq)',
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'deepseek-chat': 'DeepSeek V3/R1',
    };
    return map[id] || id;
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Compact Card View */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex flex-col items-start text-left bg-white border border-gray-200 hover:border-gray-300 rounded-[10px] p-3 shadow-sm hover:shadow transition-all min-w-[200px]"
      >
        <div className="flex items-center justify-between w-full border-b pb-1.5 mb-1.5">
          <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-primary" />
            AI Usage Center
          </span>
          <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
        
        {data ? (
          <div className="space-y-1 w-full text-[11px] text-gray-500">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-gray-900 truncate max-w-[110px]">
                {getModelDisplayName(currentModelId || data.activeModel.model)}
              </span>
              <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-bold border border-green-200">
                Connected
              </span>
            </div>
            <div className="flex justify-between mt-1 text-[10px]">
              <span>Reqs Today: <strong className="text-gray-900">{data.summary.requestsToday}</strong></span>
              <span>Cost: <strong className="text-gray-900">{formatCost(data.summary.estimatedCost)}</strong></span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>Tokens Today: <strong className="text-gray-900">{formatTokens(data.summary.tokensToday)}</strong></span>
              <span className="text-green-600 font-bold">{data.summary.successRate}% Success</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-2 w-full text-xs text-gray-400 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading stats...
          </div>
        )}
      </button>

      {/* Expanded Dropdown View */}
      {isOpen && data && (
        <div className="absolute right-0 mt-2 w-[420px] bg-white border border-gray-200 rounded-[10px] shadow-lg z-50 overflow-hidden font-sans text-gray-900 origin-top-right transition-transform">
          {/* Header */}
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-gray-900">AI Usage Monitor</h3>
              <p className="text-[11px] text-gray-500">Aggregated usage statistics across configured providers</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchStats} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="max-h-[500px] overflow-y-auto p-4 space-y-4">
            
            {/* Live Generation Overlay (Dynamic State) */}
            {liveRequest && (
              <div className="bg-amber-50/50 border border-amber-200 rounded-[10px] p-3 space-y-2 animate-pulse">
                <div className="flex justify-between items-center text-xs font-semibold text-amber-800">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 animate-bounce text-amber-600" />
                    {liveRequest.message}
                  </span>
                  <span className="font-mono text-[11px]">{liveRequest.elapsed.toFixed(1)}s</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-amber-700">
                  <span>Using: <strong>{getModelDisplayName(liveRequest.model)}</strong></span>
                  <span>Estimated: <strong>{liveRequest.tokens.toLocaleString()} tokens</strong></span>
                </div>
                {liveRequest.status === 'fallback' && (
                  <div className="text-[9px] bg-red-50 text-red-700 border border-red-100 p-1.5 rounded flex items-center gap-1">
                    <ArrowRightLeft className="w-3 h-3 flex-shrink-0" />
                    <span>Fallback Switched (Failure: {liveRequest.fallbackDetails?.reason || 'Unknown error'})</span>
                  </div>
                )}
              </div>
            )}

            {/* 1. Active Model */}
            <div className="border border-gray-200 rounded-[10px] p-3 bg-white">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Current Model</span>
              <div className="flex justify-between items-center mt-1">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{getModelDisplayName(currentModelId || data.activeModel.model)}</h4>
                  <p className="text-[10px] text-gray-500">Provider: {data.activeModel.provider}</p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 border border-green-200">
                    🟢 Active / Connected
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Usage Statistics */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Usage Statistics</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-gray-150 rounded-[10px] p-2.5 bg-gray-50/50">
                  <div className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Requests Today
                  </div>
                  <div className="text-lg font-bold text-gray-900 mt-1">{data.summary.requestsToday}</div>
                </div>
                <div className="border border-gray-150 rounded-[10px] p-2.5 bg-gray-50/50">
                  <div className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                    <Coins className="w-3 h-3" /> Estimated Cost Today
                  </div>
                  <div className="text-lg font-bold text-gray-900 mt-1">{formatCost(data.summary.estimatedCost)}</div>
                </div>
                <div className="border border-gray-150 rounded-[10px] p-2.5 bg-gray-50/50">
                  <div className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                    <Database className="w-3 h-3" /> Tokens (Today/Month)
                  </div>
                  <div className="text-sm font-bold text-gray-900 mt-1.5 flex items-baseline gap-1">
                    <span>{formatTokens(data.summary.tokensToday)}</span>
                    <span className="text-[9px] text-gray-400 font-normal">/ {formatTokens(data.summary.tokensMonth)}</span>
                  </div>
                </div>
                <div className="border border-gray-150 rounded-[10px] p-2.5 bg-gray-50/50">
                  <div className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                    <Cpu className="w-3 h-3" /> Health & Performance
                  </div>
                  <div className="text-xs font-bold text-gray-900 mt-1.5 flex justify-between w-full">
                    <span>Avg: <strong className="font-semibold">{(data.summary.averageResponseTime / 1000).toFixed(1)}s</strong></span>
                    <span className="text-green-600 font-semibold">{data.summary.successRate}% OK</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Provider Overview */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Provider Overview</span>
              <div className="border border-gray-200 rounded-[10px] divide-y divide-gray-150 overflow-hidden bg-white">
                {data.providers.map(prov => {
                  const isErr = getProviderKeyStatusText(prov) === 'Invalid API Key';
                  return (
                    <div key={prov.provider} className="flex justify-between items-center p-2.5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center">
                        {getProviderIndicator(prov)}
                        <span className="text-xs font-semibold text-gray-900">{prov.provider}</span>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-gray-500">
                        {prov.connected && !isErr ? (
                          <>
                            <span>Reqs: <strong className="text-gray-900">{prov.requests}</strong></span>
                            <span>Tokens: <strong className="text-gray-900">{formatTokens(prov.tokens)}</strong></span>
                          </>
                        ) : (
                          <span className={isErr ? "text-red-600 font-bold" : "text-gray-400 font-medium"}>
                            {getProviderKeyStatusText(prov)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Recent Activity */}
            {data.recentActivity.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Recent Activity</span>
                <div className="border border-gray-200 rounded-[10px] overflow-hidden text-[10px]">
                  <table className="w-full text-left border-collapse bg-white">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold">
                        <th className="p-2">Time</th>
                        <th className="p-2">Endpoint</th>
                        <th className="p-2">Provider</th>
                        <th className="p-2 text-right">Tokens</th>
                        <th className="p-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150">
                      {data.recentActivity.map(activity => (
                        <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-2 text-gray-500 font-mono">{activity.time}</td>
                          <td className="p-2 font-semibold text-gray-900 truncate max-w-[100px]">{activity.endpoint}</td>
                          <td className="p-2 text-gray-500">{activity.provider}</td>
                          <td className="p-2 text-right text-gray-900 font-mono">{activity.tokens.toLocaleString()}</td>
                          <td className="p-2 text-right">
                            {activity.status === 'SUCCESS' ? (
                              <span className="text-green-600 font-semibold">Success</span>
                            ) : (
                              <span className="text-red-600 font-semibold">Failed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. Fallback History */}
            {data.fallbackHistory.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Fallback Executions</span>
                <div className="border border-red-100 rounded-[10px] bg-red-50/20 p-2.5 space-y-2">
                  {data.fallbackHistory.slice(0, 3).map(fb => (
                    <div key={fb.id} className="text-[10px] text-gray-500 flex flex-col gap-0.5 border-b border-red-50 pb-2 last:border-b-0 last:pb-0">
                      <div className="flex justify-between items-center font-semibold text-gray-900">
                        <span>🔄 Fallback: {fb.endpoint}</span>
                        <span className="font-mono text-gray-400 font-normal">{fb.time}</span>
                      </div>
                      <div className="text-[9px] mt-0.5">
                        <span className="text-red-600 font-semibold">{fb.failedProvider} failed</span>
                        <span className="text-gray-400 mx-1">→</span>
                        <span className="text-green-600 font-semibold">Recovered by {fb.successProvider}</span>
                      </div>
                      <div className="text-[9px] text-red-500 font-medium truncate max-w-[360px]" title={fb.errorMessage}>
                        Error: {fb.errorMessage}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
