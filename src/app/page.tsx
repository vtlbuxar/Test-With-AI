"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2, UploadCloud, FileText, X, CheckCircle, AlertTriangle, Star, Download, ArrowRight, Trash2, Copy, Plus, Bug, Database, GitCompare } from "lucide-react";
import * as xlsx from "xlsx";
import { storage, Project } from "@/lib/storage";
import Link from "next/link";

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

export default function TestAnalystPage() {
  // BYOK State
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem("geminiApiKey");
    if (storedKey) setGeminiApiKey(storedKey);
  }, []);

  // Input State
  const [inputMethod, setInputMethod] = useState<"TEXT" | "FILE">("TEXT");
  const [file, setFile] = useState<File | null>(null);
  const [requirement, setRequirement] = useState("");
  const [platform, setPlatform] = useState("Web App");
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  useEffect(() => {
    if (projectId) {
      storage.getProject(projectId).then(proj => {
        if (proj) setCurrentProject(proj);
      });
    }
  }, [projectId]);

  // Loading States
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingScenarios, setLoadingScenarios] = useState(false);
  const [loadingTestCases, setLoadingTestCases] = useState(false);
  const [loadingRTM, setLoadingRTM] = useState(false);
  const [loadingSuites, setLoadingSuites] = useState(false);

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

  const handleFetch = async (endpoint: string, setLoading: (l: boolean) => void, setData: (d: any) => void) => {
    if (inputMethod === "TEXT" && !requirement.trim()) return;
    if (inputMethod === "FILE" && !file) return;
    
    setLoading(true);
    setError(null);
    try {
      const headers: HeadersInit = {};
      if (geminiApiKey) {
        headers["x-gemini-api-key"] = geminiApiKey;
      }
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: getFormData(),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Failed to fetch from ${endpoint}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : String(err);
      
      // Provide user-friendly error messages for AI rate limits and quota issues
      if (errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate limit') || errorMessage.includes('429')) {
        errorMessage = "We're experiencing high demand right now. Please wait a few seconds and try again.";
      } else if (errorMessage.includes('Failed to fetch')) {
        errorMessage = "Network error. Please check your connection and try again.";
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
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
        headers: {
          ...(geminiApiKey ? { "X-Gemini-API-Key": geminiApiKey } : {})
        },
        body: formData,
      });
      const data = await response.json();
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
        headers: {
          ...(geminiApiKey ? { "X-Gemini-API-Key": geminiApiKey } : {})
        },
        body: formData,
      });
      const data = await response.json();
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
          ...(geminiApiKey ? { "X-Gemini-API-Key": geminiApiKey } : {})
        },
        body: JSON.stringify({ requirement_v1: v1, requirement_v2: v2 }),
      });
      const data = await response.json();
      setDiffData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDiff(false);
    }
  };

  const isInputValid = inputMethod === "TEXT" ? requirement.trim().length > 0 : file !== null;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">AI Test Analyst</h1>
          <p className="text-muted-foreground">Generate comprehensive test scenarios, cases, and trace matrix from your requirements.</p>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => setShowSettings(true)} variant="secondary" className="font-medium bg-amber-100 text-amber-900 hover:bg-amber-200 border-amber-300 border">
            <Star className="w-4 h-4 mr-2 text-amber-600 fill-amber-600" />
            Unlock Advanced AI
          </Button>
          <Link href="/dashboard">
            <Button variant="outline" className="font-medium">
              View Dashboard
            </Button>
          </Link>
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
              <div className="flex bg-muted p-1 rounded-md">
                <Button 
                  variant={inputMethod === "TEXT" ? "default" : "ghost"} 
                  onClick={() => setInputMethod("TEXT")}
                  className="w-full h-8"
                >
                  Text
                </Button>
                <Button 
                  variant={inputMethod === "FILE" ? "default" : "ghost"} 
                  onClick={() => setInputMethod("FILE")}
                  className="w-full h-8"
                >
                  File
                </Button>
              </div>
            </div>
            
            <div className="w-full md:w-1/3">
              <label className="text-sm font-medium mb-1.5 block">Version History</label>
              <div className="flex gap-2">
                <Select 
                  disabled={!currentProject?.versions || currentProject.versions.length === 0}
                  onValueChange={(val) => {
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
                    <SelectValue placeholder="Current Version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">Current Version</SelectItem>
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

          <div className="pt-4 border-t">
            <label className="text-sm font-medium mb-3 block">Generation Options</label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Button 
                onClick={() => handleFetch('/api/generate-analysis', setLoadingAnalysis, setAnalysisData)} 
                disabled={loadingAnalysis || !isInputValid}
                className="w-full"
                variant="outline"
              >
                {loadingAnalysis ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Consulting Experts...</>
                ) : "Test Analysis"}
              </Button>
              <Button 
                onClick={() => handleFetch('/api/generate-scenarios', setLoadingScenarios, setScenariosData)} 
                disabled={loadingScenarios || !isInputValid}
                className="w-full"
                variant="outline"
              >
                {loadingScenarios ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Consulting Experts...</>
                ) : "Test Scenarios"}
              </Button>
              <Button 
                onClick={() => handleFetch('/api/generate-tests', setLoadingTestCases, setTestCasesData)} 
                disabled={loadingTestCases || !isInputValid}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loadingTestCases ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Consulting Experts...</>
                ) : "Detailed Test Cases"}
              </Button>
              <Button 
                onClick={() => handleFetch('/api/generate-rtm', setLoadingRTM, setRtmData)} 
                disabled={loadingRTM || !isInputValid}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                {loadingRTM ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Consulting Experts...</>
                ) : "RTM Test Matrix"}
              </Button>
              <Button 
                onClick={() => handleFetch('/api/generate-suites', setLoadingSuites, setSuitesData)} 
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
            </CardContent>
          </Card>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background p-6 rounded-lg shadow-lg max-w-md w-full border animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" /> Unlock Advanced AI
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              To bypass the free tier rate limits and unlock unlimited usage, provide your own free Gemini API Key. This key is saved locally in your browser.
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Gemini API Key</label>
                <Input 
                  type="password" 
                  value={geminiApiKey} 
                  onChange={(e) => setGeminiApiKey(e.target.value)} 
                  placeholder="AIzaSy..." 
                  className="mt-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Don't have a key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium hover:underline">Get one for free here</a>.
              </p>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
              <Button onClick={() => {
                localStorage.setItem("geminiApiKey", geminiApiKey);
                setShowSettings(false);
              }}>Save API Key</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
