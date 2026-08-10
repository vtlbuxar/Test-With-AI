'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, CheckCircle, XCircle, Clock, Globe, 
  Terminal, ShieldCheck, FileSpreadsheet, Download, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function TestExecutionReport() {
  const { id } = useParams();
  const router = useRouter();
  const [runDetails, setRunDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReport() {
      if (!id) return;
      try {
        const res = await fetch(`/api/execute/progress?runId=${id}`);
        if (res.ok) {
          const data = await res.json();
          setRunDetails(data.dbDetails || null);
        }
      } catch (e) {
        console.error('Failed to load execution report details', e);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [id]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4 bg-slate-50 text-slate-800">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-900" />
        <span className="text-sm font-semibold">Generating report view...</span>
      </div>
    );
  }

  if (!runDetails) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4 bg-slate-50 text-slate-800">
        <div className="text-red-500 font-bold">Report not found</div>
        <Link href="/dashboard/execution/history">
          <Button variant="outline">Return to history</Button>
        </Link>
      </div>
    );
  }

  const metrics = runDetails.metrics || {
    totalTests: 0,
    passedCount: 0,
    failedCount: 0,
    totalDurationMs: 0,
    passRatePercentage: 0
  };

  const isPassed = metrics.failedCount === 0;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6 pb-20">
      
      {/* Header Back navigation */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/execution/history">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Execution Report</h1>
            <p className="text-sm text-slate-500 font-medium">Immutable validation feedback captured during test run.</p>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Status card */}
        <Card className="border-slate-200 bg-white shadow-sm p-4 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Validation Outcome</span>
          <div className="flex items-center space-x-2 mt-2">
            {isPassed ? (
              <CheckCircle className="h-6 w-6 text-green-500 shrink-0" />
            ) : (
              <XCircle className="h-6 w-6 text-red-500 shrink-0" />
            )}
            <span className={`text-xl font-bold ${isPassed ? 'text-green-700' : 'text-red-700'}`}>
              {isPassed ? 'PASSED' : 'FAILED'}
            </span>
          </div>
        </Card>

        {/* Pass rate card */}
        <Card className="border-slate-200 bg-white shadow-sm p-4 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pass Rate</span>
          <span className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {metrics.passRatePercentage.toFixed(0)}%
          </span>
        </Card>

        {/* Total Runs metrics */}
        <Card className="border-slate-200 bg-white shadow-sm p-4 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Test Suite Ratio</span>
          <span className="text-sm font-semibold text-slate-800 mt-2">
            Passed: <span className="font-mono text-green-600 font-bold">{metrics.passedCount}</span> | Failed: <span className="font-mono text-red-600 font-bold">{metrics.failedCount}</span>
          </span>
        </Card>

        {/* Duration */}
        <Card className="border-slate-200 bg-white shadow-sm p-4 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Execution duration</span>
          <span className="text-2xl font-bold text-slate-900 mt-2 font-mono flex items-center">
            <Clock className="h-4 w-4 mr-1 text-slate-400" />
            {(metrics.totalDurationMs / 1000).toFixed(1)}s
          </span>
        </Card>

      </div>

      {/* Execution Context Panel details */}
      <Card className="border-slate-200 bg-white shadow-sm p-6 space-y-4">
        <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
          <div className="flex items-center">
            <Globe className="h-4 w-4 mr-2 text-slate-500" />
            Execution Metadata Context
          </div>
          <div className="flex space-x-2 text-xs">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-[11px] h-7 font-sans px-2.5"
              onClick={() => window.open(`/storage/test-runs/logs/${runDetails.id}-execution-logs.txt`, '_blank')}
            >
              <Terminal className="h-3.5 w-3.5 mr-1 text-slate-500" />
              Logs
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-[11px] h-7 font-sans px-2.5"
              onClick={() => window.open(`/storage/test-runs/logs/${runDetails.id}-trace.zip`, '_blank')}
            >
              <Download className="h-3.5 w-3.5 mr-1 text-slate-500" />
              Playwright Trace
            </Button>
          </div>
        </CardTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs text-slate-600 font-mono">
          <div className="flex flex-col">
            <span className="text-slate-400 font-sans font-semibold">Run ID Hash</span>
            <span className="text-slate-900 font-bold mt-0.5 truncate">{runDetails.id}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400 font-sans font-semibold">Target URL</span>
            <span className="text-slate-900 font-bold mt-0.5 truncate">{runDetails.executions?.[0]?.testCaseVersion?.testCase?.project?.websiteUrl || 'https://www.saucedemo.com/'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400 font-sans font-semibold">Browser</span>
            <span className="text-slate-900 font-bold mt-0.5 uppercase">chromium (headless)</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400 font-sans font-semibold">Created Date</span>
            <span className="text-slate-900 font-bold mt-0.5">{new Date(runDetails.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </Card>

      {/* Loop executions list */}
      <div className="space-y-6">
        <h3 className="text-base font-bold text-slate-900">Case-by-Case Execution Details</h3>
        
        {runDetails.executions.map((exec: any, execIdx: number) => {
          const isCasePassed = exec.status === 'PASSED';
          return (
            <Card key={exec.id} className="border-slate-200 bg-white shadow-sm overflow-hidden">
              
              {/* Executed Case Header */}
              <div className="bg-slate-50/50 border-b border-slate-100 p-4 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-xs font-mono font-bold text-slate-400">TEST CASE #{execIdx + 1}</span>
                  <span className="font-bold text-sm text-slate-800 mt-0.5">Automated playwright run</span>
                </div>
                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-slate-400 font-semibold font-mono">{(exec.executionTimeMs / 1000).toFixed(2)}s</span>
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                    isCasePassed ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'
                  }`}>
                    {exec.status}
                  </span>
                </div>
              </div>

              {/* Case Steps */}
              <div className="p-4 space-y-4">
                <Table className="w-full text-left text-xs font-sans">
                  <TableHeader className="bg-slate-50/20">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[80px] font-semibold text-slate-600">Step</TableHead>
                      <TableHead className="w-[300px] font-semibold text-slate-600">Expected Result</TableHead>
                      <TableHead className="font-semibold text-slate-600">DeepSeek Semantic Reasoning (Actual)</TableHead>
                      <TableHead className="w-[120px] font-semibold text-slate-600">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100">
                    {exec.steps.map((step: any) => {
                      const hasExpected = step.actualResult && step.actualResult.includes('### Expected');
                      const expectedText = hasExpected
                        ? step.actualResult.match(/### Expected\n([\s\S]*?)(?=\n\n###|$)/)?.[1]?.trim()
                        : 'Verify outcome successfully';
                      const observedText = hasExpected
                        ? step.actualResult.match(/### Observed\n([\s\S]*?)(?=\n\n###|$)/)?.[1]?.trim()
                        : step.actualResult || 'Action completed successfully.';

                      const isWarning = step.actualResult?.includes('Status: WARNING');
                      const isBlocked = step.status === 'BLOCKED' || step.actualResult?.includes('Status: BLOCKED') || step.actualResult?.includes('AI Validation Service Unavailable');
                      const displayStatus = isWarning ? 'WARNING' : isBlocked ? 'BLOCKED' : step.status;

                      const badgeStyle = displayStatus === 'PASSED'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : displayStatus === 'WARNING'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : displayStatus === 'BLOCKED'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-red-50 text-red-700 border-red-200';

                      return (
                        <TableRow key={step.id} className="hover:bg-slate-50/30">
                          <td className="py-3 font-semibold text-slate-900">Step {step.stepNumber}</td>
                          <td className="py-3 text-slate-500 font-medium">{expectedText}</td>
                          <td className="py-3 text-slate-800 font-mono text-[11px] whitespace-pre-wrap">{observedText}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded font-bold text-[9px] border ${badgeStyle}`}>
                              {displayStatus}
                            </span>
                          </td>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Evidence screenshot thumbnail slider */}
                {exec.attachments && exec.attachments.length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Step Action Screenshots Evidence</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                      {exec.attachments.map((att: any) => (
                        <div key={att.id} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 group hover:shadow transition-shadow">
                          <img 
                            src={att.fileUrl} 
                            alt={att.fileName}
                            className="w-full h-32 object-cover object-top border-b border-slate-200 cursor-pointer"
                            onClick={() => window.open(att.fileUrl, '_blank')}
                          />
                          <div className="p-2 text-[10px] text-slate-500 font-mono truncate" title={att.fileName}>
                            {att.fileName}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </Card>
          );
        })}
      </div>

    </div>
  );
}
