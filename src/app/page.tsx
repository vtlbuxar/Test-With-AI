"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2, UploadCloud, FileText, X, CheckCircle, AlertTriangle, Star, Download, ArrowRight, Trash2, Copy, Plus, Bug, Database, GitCompare, LogOut, User } from "lucide-react";
import * as xlsx from "xlsx";
import { storage, Project } from "@/lib/storage";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/lib/use-auth";
import { AIUsageCenter } from "@/components/dashboard/ai-usage-center";

// --- Types ---
type TestCase = {
  test_case_id: string;
  type: string;
  summary: string;
  steps: string;
  expected_result: string;
  priority: string;
  title?: string;
  risk_level?: "High" | "Medium" | "Low";
  risk_justification?: string;
};

type TestScenario = {
  scenario_id: string;
  category: "Positive/Happy Path" | "Negative/Exception Path" | "Boundary/Edge Cases";
  description: string;
};

type QualityScore = {
  overall_score_percentage: number;
  requirement_coverage_percentage: number;
  duplicate_count: number;
  missing_scenarios: string[];
  coverage_breakdown: {
    positive_coverage: boolean;
    negative_coverage: boolean;
    boundary_coverage: boolean;
    security_coverage: boolean;
    accessibility_coverage: boolean;
    api_validation: boolean;
  };
};

type RTMItem = {
  req_id: string;
  type: "Functional" | "Non-Functional";
  description: string;
  testable_items: string[];
};

type TestSuiteItem = TestCase & {
  justification: string;
};

type SuitesData = {
  smoke_tests: TestSuiteItem[];
  regression_tests: TestSuiteItem[];
};

export interface ProviderState {
  apiKey: string;
  status: 'connected' | 'not_configured' | 'invalid_key';
  validating?: boolean;
}

export interface ModelItem {
  id: string;
  name: string;
  providerId: string;
  enabled: boolean;
}

export interface GenerationSummary {
  provider: string;
  model: string;
  durationMs: number;
  tokens: number;
  fallbackUsed: boolean;
  status: 'Success' | 'Error';
  fallbackReason?: string;
  attempts: Array<{ model: string; provider: string; error: string }>;
}

const INITIAL_PROVIDERS = {
  gemini: { name: "Google Gemini", placeholder: "AIzaSy..." },
  groq: { name: "Groq", placeholder: "gsk_..." },
  openai: { name: "OpenAI", placeholder: "sk-proj-..." },
  anthropic: { name: "Anthropic Claude", placeholder: "sk-ant-..." },
  openrouter: { name: "OpenRouter", placeholder: "sk-or-v1-..." },
  deepseek: { name: "DeepSeek", placeholder: "sk-..." }
};

const INITIAL_MODELS: ModelItem[] = [
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Free Tier)", providerId: "gemini", enabled: true },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", providerId: "gemini", enabled: false },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash (Free Tier)", providerId: "gemini", enabled: false },
  { id: "claude-3-5-sonnet-latest", name: "Claude 3.5 Sonnet", providerId: "anthropic", enabled: true },
  { id: "claude-3-5-haiku-latest", name: "Claude 3.5 Haiku", providerId: "anthropic", enabled: false },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B (Free Dev Tier)", providerId: "groq", enabled: true },
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Free Dev Tier)", providerId: "groq", enabled: false },
  { id: "gpt-4o", name: "GPT-4o", providerId: "openai", enabled: false },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", providerId: "openai", enabled: false },
  { id: "openrouter/openrouter/free", name: "OpenRouter Free Router (Free)", providerId: "openrouter", enabled: false },
  { id: "openrouter/deepseek/deepseek-chat", name: "DeepSeek Chat", providerId: "openrouter", enabled: false },
  { id: "deepseek-chat", name: "DeepSeek V3/R1", providerId: "deepseek", enabled: false },
];

// Helper to strip non-ISO-8859-1 / non-ASCII characters from headers
const sanitizeHeaderValue = (val?: string | null): string => {
  if (!val) return "";
  return val
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
};

export default function TestAnalystPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  // Redirect admin users to the admin dashboard directly
  useEffect(() => {
    if (user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
      router.push('/admin');
    }
  }, [user, router]);


  // AI Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [providers, setProviders] = useState<Record<string, ProviderState>>({
    gemini: { apiKey: "", status: "not_configured" },
    groq: { apiKey: "", status: "not_configured" },
    openai: { apiKey: "", status: "not_configured" },
    anthropic: { apiKey: "", status: "not_configured" },
    openrouter: { apiKey: "", status: "not_configured" },
    deepseek: { apiKey: "", status: "not_configured" }
  });

  const [models, setModels] = useState<ModelItem[]>(INITIAL_MODELS);
  const [defaultModelId, setDefaultModelId] = useState<string>("gemini-2.0-flash");
  const [generationSummaries, setGenerationSummaries] = useState<Record<string, GenerationSummary>>({});
  const [fallbackAlert, setFallbackAlert] = useState<{ failedModel: string; successModel: string; reason?: string } | null>(null);

  useEffect(() => {
    // Load from localStorage
    const savedProviders = localStorage.getItem("ai_providers");
    const savedModels = localStorage.getItem("ai_models_order");
    const savedDefault = localStorage.getItem("ai_default_model");

    let currentProviders: Record<string, ProviderState> = {
      gemini: { apiKey: "", status: "not_configured" },
      groq: { apiKey: "", status: "not_configured" },
      openai: { apiKey: "", status: "not_configured" },
      anthropic: { apiKey: "", status: "not_configured" },
      openrouter: { apiKey: "", status: "not_configured" },
      deepseek: { apiKey: "", status: "not_configured" }
    };

    if (savedProviders) {
      try {
        currentProviders = JSON.parse(savedProviders);
        setProviders(currentProviders);
      } catch (e) { console.error(e); }
    } else {
      // Legacy support: copy old geminiApiKey if it exists
      const oldKey = localStorage.getItem("geminiApiKey");
      if (oldKey) {
        currentProviders.gemini = { apiKey: oldKey, status: "connected" };
        setProviders(currentProviders);
      }
    }

    // Sync old key state variable for backward compatibility
    if (currentProviders.gemini?.apiKey) {
      setGeminiApiKey(currentProviders.gemini.apiKey);
    }

    if (savedModels) {
      try {
        const parsedOrder = JSON.parse(savedModels) as Array<{ id: string; enabled: boolean }>;
        
        // Detect if any saved model is no longer part of our active INITIAL_MODELS list
        const initialIds = INITIAL_MODELS.map(m => m.id);
        const hasDeprecated = parsedOrder.some(p => !initialIds.includes(p.id));
        
        if (hasDeprecated) {
          // Force reset models order and defaults to clean up stale entries
          setModels(INITIAL_MODELS);
          setDefaultModelId("gemini-2.0-flash");
          saveAISettings(currentProviders, INITIAL_MODELS, "gemini-2.0-flash");
        } else {
          const ordered = [...INITIAL_MODELS];
          ordered.sort((a, b) => {
            const idxA = parsedOrder.findIndex(m => m.id === a.id);
            const idxB = parsedOrder.findIndex(m => m.id === b.id);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          });
          const withEnabled = ordered.map(m => {
            const saved = parsedOrder.find(p => p.id === m.id);
            return saved ? { ...m, enabled: saved.enabled } : m;
          });
          setModels(withEnabled);
        }
      } catch (e) { console.error(e); }
    }

    if (savedDefault) {
      if (INITIAL_MODELS.some(m => m.id === savedDefault)) {
        setDefaultModelId(savedDefault);
      } else {
        setDefaultModelId("gemini-2.0-flash");
      }
    }
  }, []);

  const saveAISettings = (newProviders: Record<string, ProviderState>, newModels: ModelItem[], newDefault: string) => {
    localStorage.setItem("ai_providers", JSON.stringify(newProviders));
    localStorage.setItem("ai_models_order", JSON.stringify(newModels.map(m => ({ id: m.id, enabled: m.enabled }))));
    localStorage.setItem("ai_default_model", newDefault);
    
    // Legacy support sync
    if (newProviders.gemini?.apiKey) {
      localStorage.setItem("geminiApiKey", newProviders.gemini.apiKey);
      setGeminiApiKey(newProviders.gemini.apiKey);
    } else {
      localStorage.removeItem("geminiApiKey");
      setGeminiApiKey("");
    }
  };

  const getModelName = (id: string) => {
    return INITIAL_MODELS.find(m => m.id === id)?.name || id;
  };

  const getProviderName = (id: string) => {
    const providerId = INITIAL_MODELS.find(m => m.id === id)?.providerId || "";
    return INITIAL_PROVIDERS[providerId as keyof typeof INITIAL_PROVIDERS]?.name || "Unknown";
  };

  const getAIHeaders = (): HeadersInit => {
    const activeProviders = Object.keys(providers).reduce((acc, key) => {
      acc[key] = { apiKey: providers[key].apiKey };
      return acc;
    }, {} as Record<string, { apiKey: string }>);

    const aiConfig = {
      providers: activeProviders,
      fallbackOrder: models.filter(m => m.enabled).map(m => m.id),
      defaultModel: defaultModelId,
    };

    const headers: HeadersInit = {
      "x-ai-config": encodeURIComponent(JSON.stringify(aiConfig))
    };

    const cleanKey = sanitizeHeaderValue(providers.gemini?.apiKey || geminiApiKey);
    if (cleanKey) {
      headers["x-gemini-api-key"] = cleanKey;
    }

    return headers;
  };

  const validateProviderKey = async (providerId: string) => {
    const key = providers[providerId].apiKey;
    if (!key) {
      const next = {
        ...providers,
        [providerId]: { ...providers[providerId], status: 'not_configured' as const }
      };
      setProviders(next);
      saveAISettings(next, models, defaultModelId);
      return;
    }

    setProviders(prev => ({
      ...prev,
      [providerId]: { ...prev[providerId], validating: true }
    }));

    try {
      const response = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, apiKey: key })
      });
      const data = await response.json();
      
      const newStatus = data.valid ? 'connected' as const : 'invalid_key' as const;
      if (data.valid && data.warning) {
        alert(`⚠️ ${data.warning}\n\nKey is authenticated successfully, but API calls might fail due to quota limits.`);
      }
      if (!data.valid && data.error) {
        console.warn(`Validation failed for ${providerId}:`, data.error);
      }
      
      const next = {
        ...providers,
        [providerId]: { ...providers[providerId], status: newStatus, validating: false }
      };
      setProviders(next);
      saveAISettings(next, models, defaultModelId);
    } catch (e) {
      const next = {
        ...providers,
        [providerId]: { ...providers[providerId], status: 'invalid_key' as const, validating: false }
      };
      setProviders(next);
      saveAISettings(next, models, defaultModelId);
    }
  };

  const GenerationSummaryCard = ({ endpoint }: { endpoint: string }) => {
    const summary = generationSummaries[endpoint];
    if (!summary) return null;

    return (
      <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap justify-between items-center text-xs text-slate-500 gap-4 animate-in fade-in">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">🤖 Generation Summary</span>
          <span className="h-3 w-px bg-slate-200" />
          <span>Provider: <strong className="text-slate-700">{summary.provider}</strong></span>
          <span className="h-3 w-px bg-slate-200" />
          <span>Model: <strong className="text-slate-700">{getModelName(summary.model)}</strong></span>
        </div>
        <div className="flex items-center gap-4">
          <span>Time: <strong className="text-slate-700">{(summary.durationMs / 1000).toFixed(1)}s</strong></span>
          <span>Tokens: <strong className="text-slate-700">{summary.tokens.toLocaleString()}</strong></span>
          <span>Fallback: <strong className={summary.fallbackUsed ? "text-amber-600 font-bold" : "text-slate-700"}>{summary.fallbackUsed ? "Yes" : "No"}</strong></span>
          <span className="flex items-center gap-1">
            Status: 
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-bold ${
              summary.status === 'Success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              ● {summary.status}
            </span>
          </span>
        </div>
      </div>
    );
  };

  // Input State
  const [inputMethod, setInputMethod] = useState<"TEXT" | "FILE">("TEXT");
  const [file, setFile] = useState<File | null>(null);
  const [requirement, setRequirement] = useState("");
  const [platform, setPlatform] = useState("Web App");
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string>("latest");

  useEffect(() => {
    if (projectId) {
      storage.getProject(projectId).then(proj => {
        if (proj) setCurrentProject(proj);
      });
    }
  }, [projectId]);

  useEffect(() => {
    setSelectedVersion("latest");
  }, [currentProject]);

  // Loading States
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingScenarios, setLoadingScenarios] = useState(false);
  const [loadingTestCases, setLoadingTestCases] = useState(false);
  const [loadingRTM, setLoadingRTM] = useState(false);
  const [loadingSuites, setLoadingSuites] = useState(false);
  const [loadingRunAll, setLoadingRunAll] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Data States
  const [analysisData, setAnalysisData] = useState<{ requirement_analysis: string } | null>(null);
  const [scenariosData, setScenariosData] = useState<{ test_scenarios: TestScenario[] } | null>(null);
  const [testCasesData, setTestCasesData] = useState<{ test_cases: TestCase[], quality_score: QualityScore } | null>(null);
  const [rtmData, setRtmData] = useState<{ summary: string, rtm: RTMItem[] } | null>(null);
  const [suitesData, setSuitesData] = useState<SuitesData | null>(null);

  // Advanced Generation States
  const [activeTestCaseForDefects, setActiveTestCaseForDefects] = useState<TestCase | null>(null);
  const [defectsData, setDefectsData] = useState<any>(null);
  const [loadingDefects, setLoadingDefects] = useState(false);

  const [activeTestCaseForData, setActiveTestCaseForData] = useState<TestCase | null>(null);
  const [testData, setTestData] = useState<any>(null);
  const [loadingTestData, setLoadingTestData] = useState(false);

  const [diffData, setDiffData] = useState<any>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv']
    },
    maxFiles: 1
  });

  const getFormData = () => {
    const formData = new FormData();
    formData.append("platform", platform);
    if (inputMethod === "TEXT") {
      formData.append("requirement", requirement);
    } else if (file) {
      formData.append("file", file);
    }
    return formData;
  };

  const handleFetch = async (
    endpoint: string,
    setLoading: (l: boolean) => void,
    setData: (d: any) => void,
    activeProjectId: string
  ): Promise<{ success: boolean; projectId: string }> => {
    if (inputMethod === "TEXT" && !requirement.trim()) return { success: false, projectId: activeProjectId };
    if (inputMethod === "FILE" && !file) return { success: false, projectId: activeProjectId };
    
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: getAIHeaders(),
        body: getFormData(),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        if (errData?.error === 'QUOTA_EXCEEDED') {
          setQuotaExceeded(true);
          setShowSettings(true);
          throw new Error("You have used your 3 free generations. Please provide your own API key to continue.");
        }
        throw new Error(errData?.error || `Failed to fetch from ${endpoint}`);
      }

      const result = await response.json();
      const modelUsed = response.headers.get('X-Model-Used');
      if (modelUsed) {
        console.log(
          `%c🤖 AI Model Used [${endpoint}]%c ${modelUsed}`,
          'color: #a855f7; font-weight: bold;',
          'color: #22d3ee; font-weight: normal;'
        );
      }

      const summaryHeader = response.headers.get('X-Generation-Summary');
      if (summaryHeader) {
        try {
          const summary = JSON.parse(decodeURIComponent(summaryHeader)) as GenerationSummary;
          setGenerationSummaries(prev => ({
            ...prev,
            [endpoint]: summary
          }));

          if (summary.fallbackUsed && summary.attempts && summary.attempts.length > 0) {
            const failedModelNames = Array.from(new Set(summary.attempts.map((att: any) => getModelName(att.model)))).join(", ");
            setFallbackAlert({
              failedModel: failedModelNames,
              successModel: getModelName(summary.model),
              reason: summary.attempts[summary.attempts.length - 1].error
            });
            setTimeout(() => {
              setFallbackAlert(null);
            }, 8000);
          }
        } catch (e) {
          console.error("Failed to parse generation summary header:", e);
        }
      }

      setData(result);

      // Auto-save generated artifact to database immediately (without requiring manual user interaction)
      let savedProjId = activeProjectId;
      try {
        const artifactKeys: Record<string, 'analysis' | 'scenarios' | 'testCases' | 'rtm' | 'suites'> = {
          '/api/generate-analysis': 'analysis',
          '/api/generate-scenarios': 'scenarios',
          '/api/generate-tests': 'testCases',
          '/api/generate-rtm': 'rtm',
          '/api/generate-suites': 'suites',
        };
        const key = artifactKeys[endpoint];
        if (key) {
          const title = getRequirementTitle();
          savedProjId = await storage.updateArtifact(activeProjectId, title, key, result);
          setProjectId(savedProjId);
        }
      } catch (saveErr) {
        console.error("Failed to auto-save generated artifact:", saveErr);
      }

      return { success: true, projectId: savedProjId };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log("Fetch request was aborted.");
        setError("Generation stopped by user.");
        return { success: false, projectId: activeProjectId };
      }
      let errorMessage = err instanceof Error ? err.message : String(err);
      
      // Provide user-friendly error messages for AI rate limits and header encoding issues
      if (!errorMessage.startsWith('All configured models failed')) {
        if (errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate limit') || errorMessage.includes('429')) {
          errorMessage = "We're experiencing high demand right now. Please wait a few seconds and try again.";
        }
      }
      if (errorMessage.includes('ISO-8859-1') || errorMessage.includes('headers')) {
        errorMessage = "Invalid API Key format: Key contains special or non-ASCII characters. Please update your key in Settings.";
      } else if (errorMessage.includes('Failed to fetch')) {
        errorMessage = "Network error. Please check your connection and try again.";
      }
      
      setError(errorMessage);
      return { success: false, projectId: activeProjectId };
    } finally {
      setLoading(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleRunAll = async () => {
    if (inputMethod === "TEXT" && !requirement.trim()) return;
    if (inputMethod === "FILE" && !file) return;

    setLoadingRunAll(true);
    let currentId = projectId;
    try {
      // 1. Test Analysis
      const r1 = await handleFetch('/api/generate-analysis', setLoadingAnalysis, setAnalysisData, currentId);
      if (!r1.success) return;
      currentId = r1.projectId;

      // 2. Test Scenarios
      const r2 = await handleFetch('/api/generate-scenarios', setLoadingScenarios, setScenariosData, currentId);
      if (!r2.success) return;
      currentId = r2.projectId;

      // 3. Detailed Test Cases
      const r3 = await handleFetch('/api/generate-tests', setLoadingTestCases, setTestCasesData, currentId);
      if (!r3.success) return;
      currentId = r3.projectId;

      // 4. RTM Test Matrix
      const r4 = await handleFetch('/api/generate-rtm', setLoadingRTM, setRtmData, currentId);
      if (!r4.success) return;
      currentId = r4.projectId;

      // 5. Smoke & Regression
      await handleFetch('/api/generate-suites', setLoadingSuites, setSuitesData, currentId);
    } catch (e) {
      console.error("Run All execution halted:", e);
    } finally {
      setLoadingRunAll(false);
    }
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoadingRunAll(false);
    setLoadingAnalysis(false);
    setLoadingScenarios(false);
    setLoadingTestCases(false);
    setLoadingRTM(false);
    setLoadingSuites(false);
  };

  const handleTestCaseChange = (index: number, field: keyof TestCase, value: string) => {
    if (!testCasesData) return;
    const newTestCases = [...testCasesData.test_cases];
    (newTestCases[index] as Record<string, unknown>)[field] = value;
    setTestCasesData({ ...testCasesData, test_cases: newTestCases });
  };

  const handleDeleteTestCase = (index: number) => {
    if (!testCasesData) return;
    const newTestCases = [...testCasesData.test_cases];
    newTestCases.splice(index, 1);
    setTestCasesData({ ...testCasesData, test_cases: newTestCases });
  };

  const handleDuplicateTestCase = (index: number) => {
    if (!testCasesData) return;
    const newTestCases = [...testCasesData.test_cases];
    const tcToDuplicate = newTestCases[index];
    const duplicatedTc = { 
      ...tcToDuplicate, 
      test_case_id: `${tcToDuplicate.test_case_id}_copy` 
    };
    newTestCases.splice(index + 1, 0, duplicatedTc);
    setTestCasesData({ ...testCasesData, test_cases: newTestCases });
  };

  const handleAddTestCase = () => {
    if (!testCasesData) return;
    const newTestCases = [...testCasesData.test_cases];
    newTestCases.push({
      test_case_id: `TC_NEW_${newTestCases.length + 1}`,
      type: "Functional",
      summary: "",
      steps: "",
      expected_result: "",
      priority: "Medium"
    });
    setTestCasesData({ ...testCasesData, test_cases: newTestCases });
  };

  const handleSuiteItemChange = (suiteName: 'smoke_tests' | 'regression_tests', index: number, field: string, value: string) => {
    if (!suitesData) return;
    const newSuite = [...suitesData[suiteName]];
    (newSuite[index] as any)[field] = value;
    setSuitesData({ ...suitesData, [suiteName]: newSuite });
  };

  const handleDeleteSuiteItem = (suiteName: 'smoke_tests' | 'regression_tests', index: number) => {
    if (!suitesData) return;
    const newSuite = [...suitesData[suiteName]];
    newSuite.splice(index, 1);
    setSuitesData({ ...suitesData, [suiteName]: newSuite });
  };

  const handleDuplicateSuiteItem = (suiteName: 'smoke_tests' | 'regression_tests', index: number) => {
    if (!suitesData) return;
    const newSuite = [...suitesData[suiteName]];
    const itemToDuplicate = newSuite[index];
    const duplicatedItem = { 
      ...itemToDuplicate, 
      test_case_id: `${itemToDuplicate.test_case_id}_copy` 
    };
    newSuite.splice(index + 1, 0, duplicatedItem);
    setSuitesData({ ...suitesData, [suiteName]: newSuite });
  };

  const handleAddSuiteItem = (suiteName: 'smoke_tests' | 'regression_tests') => {
    if (!suitesData) return;
    const newSuite = [...suitesData[suiteName]];
    newSuite.push({
      test_case_id: `TC_NEW_${newSuite.length + 1}`,
      type: "Functional",
      summary: "",
      steps: "",
      expected_result: "",
      priority: "Medium",
      justification: ""
    } as TestSuiteItem);
    setSuitesData({ ...suitesData, [suiteName]: newSuite });
  };

  const exportToExcel = (data: any[], filename: string) => {
    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    xlsx.writeFile(workbook, filename);
  };

  const getRequirementTitle = () => {
    if (inputMethod === "TEXT") {
      return requirement ? requirement.slice(0, 100) + (requirement.length > 100 ? "..." : "") : "Untitled Requirement";
    }
    return file?.name || "Untitled File Requirement";
  };

  const handleSave = async (artifactKey: 'scenarios' | 'testCases' | 'rtm' | 'suites', data: any) => {
    const title = getRequirementTitle();
    const newId = await storage.updateArtifact(projectId, title, artifactKey, data);
    setProjectId(newId);
    
    // Also save Analysis if it exists and hasn't been explicitly saved
    if (analysisData) {
      await storage.updateArtifact(newId, title, 'analysis', analysisData);
    }
  };

  const handleGenerateDefects = async (tc: TestCase) => {
    setActiveTestCaseForDefects(tc);
    setLoadingDefects(true);
    setDefectsData(null);
    try {
      const formData = getFormData();
      formData.append('testCase', JSON.stringify(tc));
      const response = await fetch('/api/generate-defects', {
        method: "POST",
        headers: getAIHeaders(),
        body: formData,
      });
      const data = await response.json();
      
      const summaryHeader = response.headers.get('X-Generation-Summary');
      if (summaryHeader) {
        try {
          const summary = JSON.parse(decodeURIComponent(summaryHeader)) as GenerationSummary;
          setGenerationSummaries(prev => ({ ...prev, '/api/generate-defects': summary }));
          if (summary.fallbackUsed && summary.attempts.length > 0) {
            const failedModelNames = Array.from(new Set(summary.attempts.map(att => getModelName(att.model)))).join(", ");
            setFallbackAlert({
              failedModel: failedModelNames,
              successModel: getModelName(summary.model),
              reason: summary.attempts[summary.attempts.length - 1].error
            });
            setTimeout(() => setFallbackAlert(null), 8000);
          }
        } catch (e) { console.error(e); }
      }

      setDefectsData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDefects(false);
    }
  };

  const handleGenerateTestData = async (tc: TestCase) => {
    setActiveTestCaseForData(tc);
    setLoadingTestData(true);
    setTestData(null);
    try {
      const formData = getFormData();
      formData.append('testCase', JSON.stringify(tc));
      const response = await fetch('/api/generate-test-data', {
        method: "POST",
        headers: getAIHeaders(),
        body: formData,
      });
      const data = await response.json();

      const summaryHeader = response.headers.get('X-Generation-Summary');
      if (summaryHeader) {
        try {
          const summary = JSON.parse(decodeURIComponent(summaryHeader)) as GenerationSummary;
          setGenerationSummaries(prev => ({ ...prev, '/api/generate-test-data': summary }));
          if (summary.fallbackUsed && summary.attempts.length > 0) {
            const failedModelNames = Array.from(new Set(summary.attempts.map(att => getModelName(att.model)))).join(", ");
            setFallbackAlert({
              failedModel: failedModelNames,
              successModel: getModelName(summary.model),
              reason: summary.attempts[summary.attempts.length - 1].error
            });
            setTimeout(() => setFallbackAlert(null), 8000);
          }
        } catch (e) { console.error(e); }
      }

      setTestData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTestData(false);
    }
  };

  const handleCompareVersions = async () => {
    if (!currentProject || !currentProject.versions || currentProject.versions.length === 0) return;
    setLoadingDiff(true);
    setDiffData(null);
    try {
      const v2 = currentProject.requirementText;
      const v1 = currentProject.versions[currentProject.versions.length - 1].requirementText;
      
      const response = await fetch('/api/generate-diff', {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          ...getAIHeaders()
        },
        body: JSON.stringify({ requirement_v1: v1, requirement_v2: v2 }),
      });
      const data = await response.json();

      const summaryHeader = response.headers.get('X-Generation-Summary');
      if (summaryHeader) {
        try {
          const summary = JSON.parse(decodeURIComponent(summaryHeader)) as GenerationSummary;
          setGenerationSummaries(prev => ({ ...prev, '/api/generate-diff': summary }));
          if (summary.fallbackUsed && summary.attempts.length > 0) {
            const failedModelNames = Array.from(new Set(summary.attempts.map(att => getModelName(att.model)))).join(", ");
            setFallbackAlert({
              failedModel: failedModelNames,
              successModel: getModelName(summary.model),
              reason: summary.attempts[summary.attempts.length - 1].error
            });
            setTimeout(() => setFallbackAlert(null), 8000);
          }
        } catch (e) { console.error(e); }
      }

      setDiffData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDiff(false);
    }
  };

  const isGenerating = loadingAnalysis || loadingScenarios || loadingTestCases || loadingRTM || loadingSuites || loadingDefects || loadingTestData || loadingDiff;

  const isInputValid = inputMethod === "TEXT" ? requirement.trim().length > 0 : file !== null;

  // Loading guard or immediate redirect to avoid UI flashing (safely placed after all hook declarations)
  if (loading || (user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'))) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-teal-500" />
          <p className="text-sm text-zinc-400 font-medium">Routing to workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">AI Test Analyst</h1>
          <p className="text-muted-foreground">Generate comprehensive test scenarios, cases, and trace matrix from your requirements.</p>
        </div>
        <div className="flex items-center gap-3">
          <AIUsageCenter currentModelId={defaultModelId} />
          <Button onClick={() => setShowSettings(true)} variant="secondary" className="font-medium bg-amber-100 text-amber-900 hover:bg-amber-200 border-amber-300 border">
            <Star className="w-4 h-4 mr-2 text-amber-600 fill-amber-600" />
            Unlock Advanced AI
          </Button>
          <Link href="/dashboard">
            <Button variant="outline" className="font-medium">
              View Dashboard
            </Button>
          </Link>
          {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
            <Link href="/admin">
              <Button variant="outline" className="border-teal-300 text-teal-700 bg-teal-50 hover:bg-teal-100 hover:text-teal-800 font-medium">
                Admin Panel
              </Button>
            </Link>
          )}
          {user && (
            <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-muted/40">
              <Link href="/profile" className="flex items-center gap-2 group hover:opacity-80 transition-opacity">
                <User className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium max-w-[120px] truncate">{user.name}</span>
              </Link>
              <div className="w-[1px] h-4 bg-border mx-1"></div>
              <button
                onClick={logout}
                title="Sign out"
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>1. Ingestion</CardTitle>
          <CardDescription>Provide your requirement via text or file upload.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
            <div className="w-full md:w-1/3">
              <label className="text-sm font-medium mb-1.5 block">Platform Context</label>
              <Select value={platform} onValueChange={(val) => setPlatform(val || "Web App")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Web App">Web App</SelectItem>
                  <SelectItem value="Mobile App">Mobile App</SelectItem>
                  <SelectItem value="API">API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-1/3">
              <label className="text-sm font-medium mb-1.5 block">Input Method</label>
              <div className="flex bg-muted p-1 rounded-md w-full">
                <Button 
                  variant={inputMethod === "TEXT" ? "default" : "ghost"} 
                  onClick={() => setInputMethod("TEXT")}
                  className="flex-1 h-8"
                >
                  Text
                </Button>
                <Button 
                  variant={inputMethod === "FILE" ? "default" : "ghost"} 
                  onClick={() => setInputMethod("FILE")}
                  className="flex-1 h-8"
                >
                  File
                </Button>
              </div>
            </div>
            
            <div className="w-full md:w-1/3">
              <label className="text-sm font-medium mb-1.5 block">Version History</label>
              <div className="flex gap-2">
                <Select 
                  value={selectedVersion}
                  onValueChange={(val: string | null) => {
                    if (!val) return;
                    setSelectedVersion(val);
                    if (val === 'latest' && currentProject) {
                      setRequirement(currentProject.requirementText);
                      setAnalysisData(currentProject.analysis);
                      setScenariosData(currentProject.scenarios);
                      setTestCasesData(currentProject.testCases);
                      setRtmData(currentProject.rtm);
                      setSuitesData(currentProject.suites);
                    } else if (currentProject?.versions) {
                      const v = currentProject.versions[parseInt(val)];
                      setRequirement(v.requirementText);
                      setAnalysisData(v.analysis);
                      setScenariosData(v.scenarios);
                      setTestCasesData(v.testCases);
                      setRtmData(v.rtm);
                      setSuitesData(v.suites);
                    }
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={`v${(currentProject?.versions?.length || 0) + 1}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">v{(currentProject?.versions?.length || 0) + 1} (Current)</SelectItem>
                    {currentProject?.versions?.map((v: any, i: number) => (
                      <SelectItem key={i} value={i.toString()}>
                        v{i + 1} - {new Date(v.timestamp).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  disabled={!currentProject?.versions || currentProject.versions.length === 0 || loadingDiff}
                  onClick={handleCompareVersions}
                  variant="outline"
                  title="Compare latest with previous version"
                >
                  {loadingDiff ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          
          {inputMethod === "TEXT" ? (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Requirement Text</label>
              <Textarea 
                placeholder="As a user, I want to..." 
                className="min-h-[150px]"
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
              />
            </div>
          ) : (
            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
            >
              <input {...getInputProps()} />
              
              {file ? (
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <FileText className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                    <X className="w-4 h-4 mr-2" /> Remove File
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="p-3 bg-muted rounded-full">
                    <UploadCloud className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-lg">Drag & drop your file here</p>
                    <p className="text-sm text-muted-foreground mt-1">or click to browse from your computer</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">Supports: .pdf, .docx, .xlsx, .csv</p>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-500 text-sm mt-2 font-medium">{error}</p>}

          <div className="pt-4 border-t space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <label className="text-sm font-medium">Generation Options</label>
              <div className="flex items-center gap-2">
                {isGenerating || loadingRunAll ? (
                  <Button 
                    onClick={handleCancelGeneration}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center gap-2 self-start"
                  >
                    🛑 Stop Generation
                  </Button>
                ) : (
                  <Button 
                    onClick={handleRunAll}
                    disabled={!isInputValid}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 self-start"
                  >
                    🚀 Run All Pipeline Stages
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Button 
                onClick={() => handleFetch('/api/generate-analysis', setLoadingAnalysis, setAnalysisData, projectId)} 
                disabled={loadingAnalysis || !isInputValid}
                className="w-full"
                variant="outline"
              >
                {loadingAnalysis ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Consulting Experts...</>
                ) : "Test Analysis"}
              </Button>
              <Button 
                onClick={() => handleFetch('/api/generate-scenarios', setLoadingScenarios, setScenariosData, projectId)} 
                disabled={loadingScenarios || !isInputValid}
                className="w-full"
                variant="outline"
              >
                {loadingScenarios ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Consulting Experts...</>
                ) : "Test Scenarios"}
              </Button>
              <Button 
                onClick={() => handleFetch('/api/generate-tests', setLoadingTestCases, setTestCasesData, projectId)} 
                disabled={loadingTestCases || !isInputValid}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loadingTestCases ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Consulting Experts...</>
                ) : "Detailed Test Cases"}
              </Button>
              <Button 
                onClick={() => handleFetch('/api/generate-rtm', setLoadingRTM, setRtmData, projectId)} 
                disabled={loadingRTM || !isInputValid}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                {loadingRTM ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Consulting Experts...</>
                ) : "RTM Test Matrix"}
              </Button>
              <Button 
                onClick={() => handleFetch('/api/generate-suites', setLoadingSuites, setSuitesData, projectId)} 
                disabled={loadingSuites || !isInputValid}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              >
                {loadingSuites ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Consulting Experts...</>
                ) : "Smoke & Regression"}
              </Button>
            </div>
            
            {projectId && (
              <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20 flex items-center justify-between animate-in fade-in">
                <div>
                  <p className="font-semibold text-primary">Requirement Saved</p>
                  <p className="text-sm text-muted-foreground">Your generated artifacts are safely stored.</p>
                </div>
                <Link href={`/dashboard/${projectId}`}>
                  <Button className="font-bold">
                    Proceed to Dashboard <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-8 pb-12">
        {analysisData && (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle>Requirement Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{analysisData.requirement_analysis}</p>
              <GenerationSummaryCard endpoint="/api/generate-analysis" />
            </CardContent>
          </Card>
        )}

        {scenariosData && (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 border-l-4 border-l-indigo-500">
            <CardHeader>
              <CardTitle>Test Scenarios</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead className="w-[200px]">Category</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scenariosData.test_scenarios.map((scenario) => (
                    <TableRow key={scenario.scenario_id}>
                      <TableCell className="font-medium">{scenario.scenario_id}</TableCell>
                      <TableCell>
                        <span className={"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold " + (
                          scenario.category === 'Positive/Happy Path' ? 'bg-green-100 text-green-800' :
                          scenario.category === 'Negative/Exception Path' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        )}>
                          {scenario.category}
                        </span>
                      </TableCell>
                      <TableCell>{scenario.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-6 flex justify-end space-x-4">
                <Button 
                  onClick={() => exportToExcel(scenariosData.test_scenarios, "test_scenarios.xlsx")} 
                  size="lg" 
                  variant="outline"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export to Excel
                </Button>
                <Button onClick={() => handleSave('scenarios', scenariosData)} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Approve & Save
                </Button>
              </div>
              <GenerationSummaryCard endpoint="/api/generate-scenarios" />
            </CardContent>
          </Card>
        )}

        {testCasesData && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-l-4 border-l-yellow-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Test Case Quality Score 
                  <div className="flex text-yellow-500">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`w-5 h-5 ${star * 20 <= testCasesData.quality_score.overall_score_percentage ? 'fill-current' : ''}`} />
                    ))}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold">{testCasesData.quality_score.overall_score_percentage}%</div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div>Requirement coverage: {testCasesData.quality_score.requirement_coverage_percentage}%</div>
                    <div>Duplicate test cases: {testCasesData.quality_score.duplicate_count}</div>
                  </div>
                </div>
                
                {testCasesData.quality_score.missing_scenarios.length > 0 && (
                  <div className="text-sm">
                    <p className="font-semibold mb-1 text-red-500">Missing Areas:</p>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {testCasesData.quality_score.missing_scenarios.map((missing, i) => (
                        <li key={i}>{missing}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
                  {[
                    { key: 'positive_coverage', label: 'Positive Coverage' },
                    { key: 'negative_coverage', label: 'Negative Coverage' },
                    { key: 'boundary_coverage', label: 'Boundary Coverage' },
                    { key: 'security_coverage', label: 'Security Coverage' },
                    { key: 'accessibility_coverage', label: 'Accessibility Coverage' },
                    { key: 'api_validation', label: 'API Validation' },
                  ].map(({ key, label }) => {
                    const isCovered = testCasesData.quality_score.coverage_breakdown[key as keyof typeof testCasesData.quality_score.coverage_breakdown];
                    return (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        {isCovered ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className={isCovered ? "" : "text-muted-foreground"}>
                          {label} {isCovered ? "" : "Missing"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-600">
              <CardHeader>
                <CardTitle>Detailed Test Cases (Editable)</CardTitle>
                <CardDescription>Review and modify the generated test cases before approval.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[100px]">TC ID</TableHead>
                        <TableHead className="min-w-[100px]">Type</TableHead>
                        <TableHead className="min-w-[100px]">Priority</TableHead>
                        <TableHead className="min-w-[100px]">Risk</TableHead>
                        <TableHead className="min-w-[200px]">Summary</TableHead>
                        <TableHead className="min-w-[200px]">Steps</TableHead>
                        <TableHead className="min-w-[200px]">Expected Result</TableHead>
                        <TableHead className="w-[100px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {testCasesData.test_cases.map((tc, index) => (
                        <TableRow key={index}>
                          <TableCell><Input value={tc.test_case_id} onChange={(e) => handleTestCaseChange(index, 'test_case_id', e.target.value)} /></TableCell>
                          <TableCell><Input value={tc.type} onChange={(e) => handleTestCaseChange(index, 'type', e.target.value)} /></TableCell>
                          <TableCell><Input value={tc.priority || "Medium"} onChange={(e) => handleTestCaseChange(index, 'priority', e.target.value)} /></TableCell>
                          <TableCell><Input value={tc.risk_level || "Medium"} onChange={(e) => handleTestCaseChange(index, 'risk_level', e.target.value as any)} className={tc.risk_level === 'High' ? 'text-red-500 font-bold' : tc.risk_level === 'Low' ? 'text-green-600' : 'text-yellow-600'} /></TableCell>
                          <TableCell><Textarea value={tc.summary || tc.title || ""} onChange={(e) => handleTestCaseChange(index, 'summary', e.target.value)} className="min-h-[80px]" /></TableCell>
                          <TableCell><Textarea value={tc.steps || ""} onChange={(e) => handleTestCaseChange(index, 'steps', e.target.value)} className="min-h-[80px]" placeholder="1. ...&#10;2. ..." /></TableCell>
                          <TableCell><Textarea value={tc.expected_result} onChange={(e) => handleTestCaseChange(index, 'expected_result', e.target.value)} className="min-h-[80px]" /></TableCell>
                          <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => handleGenerateDefects(tc)} title="AI Defect Generator">
                                {loadingDefects && activeTestCaseForDefects?.test_case_id === tc.test_case_id ? <Loader2 className="h-4 w-4 animate-spin text-red-500" /> : <Bug className="h-4 w-4 text-red-500" />}
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleGenerateTestData(tc)} title="Generate Test Data">
                                {loadingTestData && activeTestCaseForData?.test_case_id === tc.test_case_id ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> : <Database className="h-4 w-4 text-blue-500" />}
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDuplicateTestCase(index)} title="Duplicate">
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteTestCase(index)} title="Delete">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-6 flex justify-between items-center">
                  <Button onClick={handleAddTestCase} variant="outline" size="lg">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Test Case
                  </Button>
                  <div className="flex space-x-4">
                    <Button 
                      onClick={() => {
                        exportToExcel(testCasesData.test_cases, "test_cases.xlsx");
                      }} 
                      size="lg" 
                      variant="outline"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export to Excel
                    </Button>
                    <Button onClick={() => handleSave('testCases', testCasesData)} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                      Approve & Save
                    </Button>
                  </div>
                </div>
                <GenerationSummaryCard endpoint="/api/generate-tests" />
              </CardContent>
            </Card>
          </div>
        )}

        {rtmData && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader>
                <CardTitle>Document Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{rtmData.summary}</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-600">
              <CardHeader>
                <CardTitle>Requirement Traceability Matrix (RTM)</CardTitle>
                <CardDescription>Comprehensive matrix mapping requirements to their testable items.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Req ID</TableHead>
                      <TableHead className="w-[150px]">Type</TableHead>
                      <TableHead className="w-[300px]">Description</TableHead>
                      <TableHead>Testable Items</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rtmData.rtm.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.req_id}</TableCell>
                        <TableCell>
                          <span className={"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold " + (
                            item.type === 'Functional' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          )}>
                            {item.type}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{item.description}</TableCell>
                        <TableCell>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            {item.testable_items.map((testItem, i) => (
                              <li key={i}>{testItem}</li>
                            ))}
                          </ul>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-6 flex justify-end space-x-4">
                  <Button 
                    onClick={() => {
                      const formattedData = rtmData.rtm.map(item => ({
                        ...item,
                        testable_items: item.testable_items.join('\n')
                      }));
                      exportToExcel(formattedData, "rtm_matrix.xlsx");
                    }} 
                    size="lg" 
                    variant="outline"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export to Excel
                  </Button>
                  <Button onClick={() => handleSave('rtm', rtmData)} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Approve RTM & Save
                  </Button>
                </div>
                <GenerationSummaryCard endpoint="/api/generate-rtm" />
              </CardContent>
            </Card>
          </div>
        )}

        {suitesData && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-l-4 border-l-teal-500">
              <CardHeader>
                <CardTitle>Smoke & Regression Test Suites</CardTitle>
                <CardDescription>Test cases automatically categorized by their importance and scope.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-teal-700">Smoke Tests</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[100px]">TC ID</TableHead>
                          <TableHead className="min-w-[100px]">Type</TableHead>
                          <TableHead className="min-w-[100px]">Priority</TableHead>
                          <TableHead className="min-w-[100px]">Risk</TableHead>
                          <TableHead className="min-w-[200px]">Summary</TableHead>
                          <TableHead className="min-w-[200px]">Steps</TableHead>
                          <TableHead className="min-w-[200px]">Expected Result</TableHead>
                          <TableHead className="min-w-[150px]">Justification</TableHead>
                          <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {suitesData.smoke_tests.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell><Input value={item.test_case_id} onChange={(e) => handleSuiteItemChange('smoke_tests', index, 'test_case_id', e.target.value)} /></TableCell>
                            <TableCell><Input value={item.type} onChange={(e) => handleSuiteItemChange('smoke_tests', index, 'type', e.target.value)} /></TableCell>
                            <TableCell><Input value={item.priority || "Medium"} onChange={(e) => handleSuiteItemChange('smoke_tests', index, 'priority', e.target.value)} /></TableCell>
                            <TableCell><Input value={item.risk_level || "Medium"} onChange={(e) => handleSuiteItemChange('smoke_tests', index, 'risk_level', e.target.value as any)} className={item.risk_level === 'High' ? 'text-red-500 font-bold' : item.risk_level === 'Low' ? 'text-green-600' : 'text-yellow-600'} /></TableCell>
                            <TableCell><Textarea value={item.summary || item.title || ""} onChange={(e) => handleSuiteItemChange('smoke_tests', index, 'summary', e.target.value)} className="min-h-[80px]" /></TableCell>
                            <TableCell><Textarea value={item.steps || ""} onChange={(e) => handleSuiteItemChange('smoke_tests', index, 'steps', e.target.value)} className="min-h-[80px]" /></TableCell>
                            <TableCell><Textarea value={item.expected_result} onChange={(e) => handleSuiteItemChange('smoke_tests', index, 'expected_result', e.target.value)} className="min-h-[80px]" /></TableCell>
                            <TableCell><Textarea value={item.justification || ""} onChange={(e) => handleSuiteItemChange('smoke_tests', index, 'justification', e.target.value)} className="min-h-[80px]" /></TableCell>
                            <TableCell>
                              <div className="flex justify-end space-x-2">
                                <Button variant="ghost" size="icon" onClick={() => handleDuplicateSuiteItem('smoke_tests', index)} title="Duplicate">
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteSuiteItem('smoke_tests', index)} title="Delete">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4">
                    <Button onClick={() => handleAddSuiteItem('smoke_tests')} variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Smoke Test
                    </Button>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-teal-700">Regression Tests</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[100px]">TC ID</TableHead>
                          <TableHead className="min-w-[100px]">Type</TableHead>
                          <TableHead className="min-w-[100px]">Priority</TableHead>
                          <TableHead className="min-w-[100px]">Risk</TableHead>
                          <TableHead className="min-w-[200px]">Summary</TableHead>
                          <TableHead className="min-w-[200px]">Steps</TableHead>
                          <TableHead className="min-w-[200px]">Expected Result</TableHead>
                          <TableHead className="min-w-[150px]">Justification</TableHead>
                          <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {suitesData.regression_tests.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell><Input value={item.test_case_id} onChange={(e) => handleSuiteItemChange('regression_tests', index, 'test_case_id', e.target.value)} /></TableCell>
                            <TableCell><Input value={item.type} onChange={(e) => handleSuiteItemChange('regression_tests', index, 'type', e.target.value)} /></TableCell>
                            <TableCell><Input value={item.priority || "Medium"} onChange={(e) => handleSuiteItemChange('regression_tests', index, 'priority', e.target.value)} /></TableCell>
                            <TableCell><Input value={item.risk_level || "Medium"} onChange={(e) => handleSuiteItemChange('regression_tests', index, 'risk_level', e.target.value as any)} className={item.risk_level === 'High' ? 'text-red-500 font-bold' : item.risk_level === 'Low' ? 'text-green-600' : 'text-yellow-600'} /></TableCell>
                            <TableCell><Textarea value={item.summary || item.title || ""} onChange={(e) => handleSuiteItemChange('regression_tests', index, 'summary', e.target.value)} className="min-h-[80px]" /></TableCell>
                            <TableCell><Textarea value={item.steps || ""} onChange={(e) => handleSuiteItemChange('regression_tests', index, 'steps', e.target.value)} className="min-h-[80px]" /></TableCell>
                            <TableCell><Textarea value={item.expected_result} onChange={(e) => handleSuiteItemChange('regression_tests', index, 'expected_result', e.target.value)} className="min-h-[80px]" /></TableCell>
                            <TableCell><Textarea value={item.justification || ""} onChange={(e) => handleSuiteItemChange('regression_tests', index, 'justification', e.target.value)} className="min-h-[80px]" /></TableCell>
                            <TableCell>
                              <div className="flex justify-end space-x-2">
                                <Button variant="ghost" size="icon" onClick={() => handleDuplicateSuiteItem('regression_tests', index)} title="Duplicate">
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteSuiteItem('regression_tests', index)} title="Delete">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4">
                    <Button onClick={() => handleAddSuiteItem('regression_tests')} variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Regression Test
                    </Button>
                  </div>
                </div>
                <div className="mt-6 flex justify-end space-x-4">
                  <Button 
                    onClick={() => {
                      exportToExcel([
                        ...suitesData.smoke_tests.map(t => ({ Suite: 'Smoke', ...t })),
                        ...suitesData.regression_tests.map(t => ({ Suite: 'Regression', ...t }))
                      ], "test_suites.xlsx");
                    }} 
                    size="lg" 
                    variant="outline"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export to Excel
                  </Button>
                  <Button onClick={() => handleSave('suites', suitesData)} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Approve & Save
                  </Button>
                </div>
                <GenerationSummaryCard endpoint="/api/generate-suites" />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Defects Modal */}
      {defectsData && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-card z-10 border-b">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Bug className="text-red-500" /> AI Defect Generator
                </CardTitle>
                <CardDescription>Predicted bugs and edge cases for {activeTestCaseForDefects?.test_case_id}</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDefectsData(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div>
                <h3 className="font-semibold text-lg text-red-600 mb-2 border-b pb-1">Security Vulnerabilities</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {defectsData.security_bugs.map((bug: string, i: number) => <li key={i}>{bug}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-orange-600 mb-2 border-b pb-1">Validation Bugs</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {defectsData.validation_bugs.map((bug: string, i: number) => <li key={i}>{bug}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-blue-600 mb-2 border-b pb-1">Possible Functional Bugs</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {defectsData.possible_bugs.map((bug: string, i: number) => <li key={i}>{bug}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-purple-600 mb-2 border-b pb-1">Edge Cases</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {defectsData.edge_cases.map((bug: string, i: number) => <li key={i}>{bug}</li>)}
                </ul>
              </div>
              <GenerationSummaryCard endpoint="/api/generate-defects" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Test Data Modal */}
      {testData && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-card z-10 border-b">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Database className="text-blue-500" /> AI Test Data Generator
                </CardTitle>
                <CardDescription>Generated datasets for {activeTestCaseForData?.test_case_id}</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setTestData(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-lg text-green-600 mb-2 border-b pb-1">Positive Data</h3>
                  <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap">
                    {JSON.stringify(testData.positive_data, null, 2)}
                  </pre>
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-red-600 mb-2 border-b pb-1">Negative Data</h3>
                  <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap">
                    {JSON.stringify(testData.negative_data, null, 2)}
                  </pre>
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-yellow-600 mb-2 border-b pb-1">Boundary Data</h3>
                  <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap">
                    {JSON.stringify(testData.boundary_data, null, 2)}
                  </pre>
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-purple-600 mb-2 border-b pb-1">Edge Case Data</h3>
                  <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap">
                    {JSON.stringify(testData.edge_case_data, null, 2)}
                  </pre>
                </div>
                <div className="col-span-1 md:col-span-2">
                  <h3 className="font-semibold text-lg text-orange-600 mb-2 border-b pb-1">Security Payloads</h3>
                  <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap">
                    {JSON.stringify(testData.security_payloads, null, 2)}
                  </pre>
                </div>
              </div>
              <GenerationSummaryCard endpoint="/api/generate-test-data" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Diff Modal */}
      {diffData && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-card z-10 border-b">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <GitCompare className="text-primary" /> Requirement Difference Analysis
                </CardTitle>
                <CardDescription>Impact analysis comparing the latest version to the previous snapshot.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDiffData(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center gap-2 mb-4 p-4 bg-muted rounded-md border">
                <span className="font-semibold text-sm">Overall Regression Scope:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  diffData.regression_scope === 'High' ? 'bg-red-100 text-red-800' :
                  diffData.regression_scope === 'Low' ? 'bg-green-100 text-green-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {diffData.regression_scope}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-semibold text-lg text-green-600 mb-2 border-b pb-1">Added Requirements</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
                    {diffData.added_requirements.length > 0 ? diffData.added_requirements.map((r: string, i: number) => <li key={i}>{r}</li>) : <li>No additions</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-red-600 mb-2 border-b pb-1">Removed Requirements</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                    {diffData.removed_requirements.length > 0 ? diffData.removed_requirements.map((r: string, i: number) => <li key={i}>{r}</li>) : <li>No removals</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-yellow-600 mb-2 border-b pb-1">Modified Requirements</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700">
                    {diffData.modified_requirements.length > 0 ? diffData.modified_requirements.map((r: string, i: number) => <li key={i}>{r}</li>) : <li>No modifications</li>}
                  </ul>
                </div>
              </div>
              <div className="mt-6 border-t pt-4">
                <h3 className="font-semibold text-lg text-blue-600 mb-2 border-b pb-1">Impacted Test Cases & Scenarios</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {diffData.impacted_test_cases.length > 0 ? diffData.impacted_test_cases.map((r: string, i: number) => <li key={i}>{r}</li>) : <li>No impacted test cases identified</li>}
                </ul>
              </div>
              <GenerationSummaryCard endpoint="/api/generate-diff" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Redesigned AI Settings Dashboard */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  ⚙️ AI Model Configuration
                </h2>
                <p className="text-sm text-slate-500">
                  Configure multiple API providers, enable models, and set priority-based failover.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)} className="rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
              {/* Quota Exceeded Alert */}
              {quotaExceeded && (
                <div className="lg:col-span-12 mb-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm font-medium flex items-start gap-3">
                  <div className="mt-0.5">⚠️</div>
                  <p>
                    You have used your 3 free generations. Please add your own API Key for the listed AI providers or buy a premium subscription to continue.
                  </p>
                </div>
              )}

              {/* Left Column: Providers (7 cols) */}
              <div className="lg:col-span-7 space-y-6">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">AI Providers</h3>
                <div className="grid grid-cols-1 gap-6">
                  {Object.entries(INITIAL_PROVIDERS).map(([id, info]) => {
                    const prov = providers[id] || { apiKey: "", status: "not_configured" };
                    return (
                      <div key={id} className="border border-slate-100 rounded-xl p-5 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                          <span className="font-semibold text-slate-800 text-sm">{info.name}</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            prov.status === 'connected' ? 'bg-green-50 text-green-700 border border-green-200' :
                            prov.status === 'invalid_key' ? 'bg-red-50 text-red-700 border border-red-200' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {prov.status === 'connected' ? '🟢 Connected' :
                             prov.status === 'invalid_key' ? '🔴 Invalid API Key' :
                             '🟡 Not Configured'}
                          </span>
                        </div>

                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <Input
                              type="password"
                              placeholder={info.placeholder}
                              value={prov.apiKey}
                              onChange={(e) => {
                                const val = e.target.value;
                                const next = {
                                  ...providers,
                                  [id]: { ...providers[id], apiKey: val, status: val ? providers[id].status : 'not_configured' as const }
                                };
                                setProviders(next);
                                saveAISettings(next, models, defaultModelId);
                              }}
                              className="bg-white text-xs h-8"
                            />
                            <Button 
                              size="sm" 
                              onClick={() => validateProviderKey(id)} 
                              disabled={prov.validating || !prov.apiKey}
                              className="shrink-0 text-xs bg-slate-800 hover:bg-slate-700 h-8 px-3"
                            >
                              {prov.validating ? 'Checking...' : 'Validate Key'}
                            </Button>
                          </div>

                          <div className="pt-2">
                            <p className="text-[10px] font-medium text-slate-400 mb-2">Available Models:</p>
                            <div className="flex flex-wrap gap-2">
                              {models.filter(m => m.providerId === id).map(m => (
                                <button
                                  key={m.id}
                                  onClick={() => {
                                    const updated = models.map(x => x.id === m.id ? { ...x, enabled: !x.enabled } : x);
                                    setModels(updated);
                                    
                                    let nextDefault = defaultModelId;
                                    if (m.id === defaultModelId && !m.enabled) {
                                      const firstEnabled = updated.find(x => x.enabled);
                                      nextDefault = firstEnabled ? firstEnabled.id : "gemini-2.0-flash";
                                      setDefaultModelId(nextDefault);
                                    }
                                    saveAISettings(providers, updated, nextDefault);
                                  }}
                                  className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs border transition-colors ${
                                    m.enabled
                                      ? 'bg-purple-50 border-purple-200 text-purple-700 font-medium'
                                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                  }`}
                                >
                                  {m.enabled ? '✓ ' : ''}{m.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Fallback Chain Priority Ordering (5 cols) */}
              <div className="lg:col-span-5 space-y-6 lg:border-l lg:border-slate-100 lg:pl-8 text-left">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Priority Chain</h3>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Drag to Reorder</span>
                </div>

                <div className="space-y-3">
                  {models.filter(m => m.enabled).map((m, idx) => {
                    const isDefault = m.id === defaultModelId;
                    return (
                      <div
                        key={m.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", models.findIndex(x => x.id === m.id).toString());
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const srcIndex = parseInt(e.dataTransfer.getData("text/plain"));
                          const targetIndex = models.findIndex(x => x.id === m.id);
                          if (srcIndex === -1 || targetIndex === -1 || srcIndex === targetIndex) return;
                          
                          const reordered = [...models];
                          const [removed] = reordered.splice(srcIndex, 1);
                          reordered.splice(targetIndex, 0, removed);
                          setModels(reordered);
                          saveAISettings(providers, reordered, defaultModelId);
                        }}
                        className={`flex items-center justify-between p-3 border rounded-xl bg-white shadow-sm hover:shadow transition-shadow cursor-grab active:cursor-grabbing ${
                          isDefault ? 'border-purple-200 bg-purple-50/20' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-slate-400">{idx + 1}</span>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-700">{m.name}</span>
                            <span className="text-[10px] text-slate-400">{getProviderName(m.id)}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setDefaultModelId(m.id);
                            saveAISettings(providers, models, m.id);
                          }}
                          className={`inline-flex items-center rounded-lg p-1.5 text-xs transition-colors ${
                            isDefault 
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                              : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                          }`}
                          title={isDefault ? "Current default model" : "Set as default"}
                        >
                          <Star className={`h-3.5 w-3.5 ${isDefault ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    );
                  })}

                  {models.filter(m => m.enabled).length === 0 && (
                    <div className="text-center py-12 border border-dashed rounded-xl text-slate-400 text-xs">
                      No models enabled. Enable models from the providers on the left.
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-purple-50/50 p-4 border border-purple-100/50 text-xs text-purple-950 space-y-2">
                  <p className="font-semibold text-purple-900">How Sequential Fallback Works:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 leading-relaxed">
                    <li>Generations always start using the default model (marked with <Star className="h-3 w-3 inline text-amber-500 fill-current" />).</li>
                    <li>If the default fails, the system automatically walks down the enabled list.</li>
                    <li>Automatic switches are visually captured and presented in the generation summary.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end">
              <Button onClick={() => setShowSettings(false)} className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-6">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Fallback Alert Banner */}
      {fallbackAlert && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-amber-50 border border-amber-200 text-amber-900 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 max-w-xl animate-in slide-in-from-top-4 duration-300">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="text-sm text-left">
            <span className="font-semibold">{fallbackAlert.failedModel}</span> failed or rate limited.
            <br />
            Switched automatically to <span className="font-semibold text-purple-700">{fallbackAlert.successModel}</span>.
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto hover:bg-amber-100" onClick={() => setFallbackAlert(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Active Model Indicator Overlay */}
      {isGenerating && (
        <div className="fixed bottom-6 right-6 z-50 bg-white border border-slate-200 shadow-2xl p-5 rounded-xl max-w-sm w-80 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-purple-600 mt-0.5 shrink-0" />
            <div className="flex-grow space-y-1 text-left">
              <p className="font-semibold text-sm text-slate-800 animate-pulse">Generating Response...</p>
              <div className="space-y-2 text-xs text-slate-500 mt-2">
                <div className="flex justify-between">
                  <span>Current Model:</span>
                  <span className="font-semibold text-slate-700">{getModelName(defaultModelId)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Provider:</span>
                  <span className="font-semibold text-slate-700">{getProviderName(defaultModelId)}</span>
                </div>
                <div className="border-t border-slate-100 pt-2 mt-2">
                  <p className="font-medium text-slate-400 mb-1">Fallback chain order:</p>
                  <ol className="list-decimal list-inside space-y-0.5 font-mono text-[10px]">
                    {models.filter(m => m.enabled).map((m) => (
                      <li key={m.id} className={m.id === defaultModelId ? "font-bold text-purple-600" : "text-slate-500"}>
                        {m.name}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
