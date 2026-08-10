'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Globe,
  Terminal, Download, RefreshCw, AlertTriangle, Info,
  ChevronDown, ChevronRight, ShieldAlert, Minus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// ─── helpers ──────────────────────────────────────────────────────────────────

function extractReason(actualResult: string | null): string {
  if (!actualResult) return 'Action completed.';

  // Strip markdown headers and return plain reason
  const cleaned = actualResult
    .replace(/###\s*(Expected|Observed|Reasoning|Status)[:\s]*/gi, '')
    .replace(/\*\*/g, '')
    .trim();

  // If there's an "Observed" block, prefer it
  const observedMatch = actualResult.match(/###\s*Observed\n([\s\S]*?)(?=\n\n###|$)/i);
  if (observedMatch) return observedMatch[1].trim();

  return cleaned.slice(0, 320) || 'Action completed.';
}

function stepStatusMeta(status: string, actualResult: string | null) {
  const isBlocked = status === 'BLOCKED' || actualResult?.includes('AI Validation Service Unavailable');
  const isWarning = actualResult?.includes('Status: WARNING');
  const resolved = isBlocked ? 'BLOCKED' : isWarning ? 'WARNING' : status;

  const map: Record<string, { label: string; icon: React.ReactNode; pill: string; bar: string; text: string }> = {
    PASSED: {
      label: 'Passed',
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />,
      pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      bar: 'bg-emerald-500',
      text: 'text-emerald-700',
    },
    FAILED: {
      label: 'Failed',
      icon: <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />,
      pill: 'bg-red-50 text-red-700 border-red-200',
      bar: 'bg-red-500',
      text: 'text-red-700',
    },
    BLOCKED: {
      label: 'Blocked',
      icon: <ShieldAlert className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />,
      pill: 'bg-purple-50 text-purple-700 border-purple-200',
      bar: 'bg-purple-500',
      text: 'text-purple-700',
    },
    WARNING: {
      label: 'Warning',
      icon: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />,
      pill: 'bg-amber-50 text-amber-700 border-amber-200',
      bar: 'bg-amber-400',
      text: 'text-amber-700',
    },
    SKIPPED: {
      label: 'Skipped',
      icon: <Minus className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />,
      pill: 'bg-slate-50 text-slate-500 border-slate-200',
      bar: 'bg-slate-300',
      text: 'text-slate-500',
    },
  };

  return map[resolved] ?? map['FAILED'];
}

// ─── Step Row ─────────────────────────────────────────────────────────────────

function StepRow({ step, idx }: { step: any; idx: number }) {
  const [open, setOpen] = useState(false);
  const meta = stepStatusMeta(step.status, step.actualResult);
  const reason = extractReason(step.actualResult);
  const shortReason = reason.slice(0, 110) + (reason.length > 110 ? '…' : '');

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      {/* Colored left-bar row */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
        onClick={() => setOpen(o => !o)}
      >
        {/* Status bar accent */}
        <div className={`w-1 self-stretch rounded-full shrink-0 ${meta.bar}`} />

        {/* Icon */}
        {meta.icon}

        {/* Step info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700">
              Step {step.stepNumber}
              {step.stepText && (
                <span className="font-normal text-slate-500 ml-2">— {step.stepText.slice(0, 80)}</span>
              )}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${meta.pill}`}>
              {meta.label.toUpperCase()}
            </span>
          </div>

          {/* Short reason always visible */}
          <p className={`text-[11px] mt-1 font-medium ${meta.text}`}>{shortReason}</p>
        </div>

        {/* Expand toggle */}
        <div className="shrink-0 text-slate-400 mt-0.5">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 space-y-3 text-xs">
          <div className="flex gap-2">
            <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-600 mb-1">Full Reason</p>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{reason}</p>
            </div>
          </div>

          {step.stepText && (
            <div className="flex gap-2">
              <Terminal className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-600 mb-1">Action Performed</p>
                <p className="text-slate-700 font-mono">{step.stepText}</p>
              </div>
            </div>
          )}

          {step.expectedResult && (
            <div className="flex gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-600 mb-1">Expected Result</p>
                <p className="text-slate-700">{step.expectedResult}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Test Case Card ────────────────────────────────────────────────────────────

function TestCaseCard({ exec, idx }: { exec: any; idx: number }) {
  const [open, setOpen] = useState(true);
  const passed = exec.status === 'PASSED';
  const steps: any[] = exec.steps || [];

  // Derive human-readable fail reason from first failed step
  const firstFailed = steps.find(s => s.status === 'FAILED' || s.status === 'BLOCKED');
  const failReason = firstFailed
    ? extractReason(firstFailed.actualResult)
    : null;

  const passedCount = steps.filter(s => s.status === 'PASSED').length;
  const failedCount = steps.filter(s => s.status !== 'PASSED').length;

  return (
    <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-5 py-4 cursor-pointer border-l-4 ${
          passed ? 'border-emerald-500 bg-emerald-50/30' : 'border-red-500 bg-red-50/20'
        }`}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {passed
            ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            : <XCircle className="h-5 w-5 text-red-500 shrink-0" />
          }
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 font-mono font-semibold">#{idx + 1}</span>
              <span className="font-bold text-sm text-slate-800 truncate">
                {exec.testCaseVersion?.testCase?.testCaseCode
                  ? `${exec.testCaseVersion.testCase.testCaseCode} — ${exec.testCaseVersion.title}`
                  : `Test Case ${idx + 1}`}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                passed
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                {passed ? 'PASSED' : 'FAILED'}
              </span>
            </div>

            {/* One-line reason visible in collapsed view */}
            {!open && !passed && failReason && (
              <p className="text-[11px] text-red-600 font-medium mt-1 line-clamp-1">
                {failReason}
              </p>
            )}
            {!open && passed && (
              <p className="text-[11px] text-emerald-600 font-medium mt-1">
                All {steps.length} steps passed successfully.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono font-semibold text-slate-500">
            <span className="text-emerald-600">{passedCount}✓</span>
            <span className="text-red-500">{failedCount}✗</span>
            <span className="text-slate-400">|</span>
            <Clock className="h-3 w-3" />
            {(exec.executionTimeMs / 1000).toFixed(1)}s
          </div>
          {open
            ? <ChevronDown className="h-4 w-4 text-slate-400" />
            : <ChevronRight className="h-4 w-4 text-slate-400" />
          }
        </div>
      </div>

      {/* Expanded content */}
      {open && (
        <div className="px-5 py-4 space-y-3">
          {/* Summary banner for failed cases */}
          {!passed && failReason && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
              <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-700 mb-0.5">Why this test failed</p>
                <p className="text-[12px] text-red-600 leading-relaxed">{failReason}</p>
              </div>
            </div>
          )}

          {/* Summary banner for passed cases */}
          {passed && (
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-700 mb-0.5">Why this test passed</p>
                <p className="text-[12px] text-emerald-700 leading-relaxed">
                  All {steps.length} step{steps.length !== 1 ? 's' : ''} executed and validated successfully.
                </p>
              </div>
            </div>
          )}

          {/* Step-by-step breakdown */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-1">
              Step-by-Step Breakdown
            </p>
            {steps.map((step, i) => {
              const tcStep = exec.testCaseVersion?.steps?.find((s: any) => s.stepNumber === step.stepNumber);
              const stepWithTemplate = {
                ...step,
                stepText: tcStep?.action || step.stepText || 'Execute step action.',
                expectedResult: tcStep?.expectedResult || step.expectedResult || 'Verify outcome.'
              };
              return <StepRow key={step.id || i} step={stepWithTemplate} idx={i} />;
            })}
          </div>

          {/* Screenshots */}
          {exec.attachments?.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Evidence Screenshots
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {exec.attachments.map((att: any) => (
                  <div
                    key={att.id}
                    className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 cursor-pointer hover:shadow transition-shadow"
                    onClick={() => window.open(att.fileUrl, '_blank')}
                  >
                    <img
                      src={att.fileUrl}
                      alt={att.fileName}
                      className="w-full h-28 object-cover object-top border-b border-slate-200"
                    />
                    <p className="px-2 py-1.5 text-[10px] text-slate-500 font-mono truncate" title={att.fileName}>
                      {att.fileName}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TestExecutionReport() {
  const { id } = useParams();
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
        console.error('Failed to load execution report', e);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [id]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-3 bg-slate-50">
        <RefreshCw className="h-7 w-7 animate-spin text-slate-500" />
        <span className="text-sm font-semibold text-slate-500">Loading report…</span>
      </div>
    );
  }

  if (!runDetails) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4 bg-slate-50">
        <XCircle className="h-10 w-10 text-red-400" />
        <p className="font-bold text-slate-700">Report not found</p>
        <Link href="/dashboard/execution/history">
          <Button variant="outline">Back to History</Button>
        </Link>
      </div>
    );
  }

  const metrics = runDetails.metrics || {
    totalTests: 0, passedCount: 0, failedCount: 0,
    totalDurationMs: 0, passRatePercentage: 0
  };

  const overallPassed = metrics.failedCount === 0;
  const executions: any[] = runDetails.executions || [];

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6 pb-24">

      {/* ── Top navigation ── */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/execution/history">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Execution Report</h1>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">{String(id)}</p>
        </div>
      </div>

      {/* ── Overall result banner ── */}
      <div className={`rounded-2xl border px-6 py-5 flex items-center justify-between gap-4 ${
        overallPassed
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-center gap-4">
          {overallPassed
            ? <CheckCircle2 className="h-9 w-9 text-emerald-500 shrink-0" />
            : <XCircle className="h-9 w-9 text-red-500 shrink-0" />
          }
          <div>
            <p className={`text-xl font-extrabold ${overallPassed ? 'text-emerald-700' : 'text-red-700'}`}>
              {overallPassed ? 'All Tests Passed' : 'Some Tests Failed'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {metrics.passedCount} passed · {metrics.failedCount} failed ·{' '}
              {metrics.passRatePercentage.toFixed(0)}% pass rate ·{' '}
              {(metrics.totalDurationMs / 1000).toFixed(1)}s total
            </p>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="text-[11px] h-7 font-mono"
            onClick={() => window.open(`/storage/test-runs/logs/${runDetails.id}-execution-logs.txt`, '_blank')}
          >
            <Terminal className="h-3 w-3 mr-1" /> Raw Logs
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-[11px] h-7 font-mono"
            onClick={() => window.open(`/storage/test-runs/logs/${runDetails.id}-trace.zip`, '_blank')}
          >
            <Download className="h-3 w-3 mr-1" /> Trace
          </Button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Cases', value: metrics.totalTests, color: 'text-slate-900' },
          { label: 'Passed', value: metrics.passedCount, color: 'text-emerald-600' },
          { label: 'Failed', value: metrics.failedCount, color: 'text-red-600' },
          { label: 'Duration', value: `${(metrics.totalDurationMs / 1000).toFixed(1)}s`, color: 'text-slate-700' },
        ].map(k => (
          <Card key={k.label} className="p-4 border-slate-200 bg-white shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k.label}</p>
            <p className={`text-2xl font-extrabold mt-1 ${k.color}`}>{k.value}</p>
          </Card>
        ))}
      </div>

      {/* ── Execution context ── */}
      <Card className="border-slate-200 bg-white shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-4 w-4 text-slate-400" />
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Execution Context</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-600">
          <div>
            <p className="text-slate-400 font-semibold mb-0.5">Target URL</p>
            <p className="font-mono text-slate-800 truncate">
              {executions[0]?.testCaseVersion?.testCase?.project?.websiteUrl || '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-400 font-semibold mb-0.5">Browser</p>
            <p className="font-mono text-slate-800 uppercase">Chromium (headless)</p>
          </div>
          <div>
            <p className="text-slate-400 font-semibold mb-0.5">Run ID</p>
            <p className="font-mono text-slate-800 truncate">{runDetails.id}</p>
          </div>
          <div>
            <p className="text-slate-400 font-semibold mb-0.5">Date</p>
            <p className="font-mono text-slate-800">{new Date(runDetails.createdAt).toLocaleString()}</p>
          </div>
        </div>
      </Card>

      {/* ── Test case cards ── */}
      <div className="space-y-4">
        <p className="text-sm font-bold text-slate-700">
          Test Case Results <span className="text-slate-400 font-normal">({executions.length} cases)</span>
        </p>
        {executions.map((exec, i) => (
          <TestCaseCard key={exec.id} exec={exec} idx={i} />
        ))}
      </div>

    </div>
  );
}
