'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Calendar, ShieldAlert, CheckCircle, 
  ChevronRight, RefreshCw, Trash2, ShieldAlert as FailIcon,
  PlayCircle, Clock, Download, FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function TestExecutionHistory() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const router = useRouter();

  const loadHistory = async () => {
    setLoading(true);
    try {
      const url = statusFilter 
        ? `/api/execute/history?status=${statusFilter}` 
        : '/api/execute/history';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [statusFilter]);

  const handleReRun = async (run: any) => {
    try {
      const selectedProject = run.project;
      if (!selectedProject) return;

      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject.id,
          testCaseIds: run.metrics ? Array(run.metrics.totalTests).fill('') : [], // placeholder trigger
          websiteUrl: 'https://example.com', // fallback
          browser: 'chromium'
        })
      });

      if (res.ok) {
        alert('Test execution enqueued in background successfully.');
        router.push('/dashboard/execution');
      } else {
        const data = await res.json();
        alert(`Failed to trigger: ${data.error || 'Server error'}`);
      }
    } catch (e) {
      alert('Error triggering execution.');
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6 pb-20">
      
      {/* Header breadcrumb */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/execution">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Execution History</h1>
            <p className="text-sm text-slate-500 font-medium font-sans">Track historical AI test runs, check reports, or schedule re-runs.</p>
          </div>
        </div>
      </div>

      {/* Tabs / Filter Controls */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
        {[
          { label: 'All Executions', val: '' },
          { label: 'Completed Runs', val: 'COMPLETED' },
          { label: 'Pending / Running', val: 'RUNNING' }
        ].map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatusFilter(tab.val)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              statusFilter === tab.val 
                ? 'bg-slate-900 text-white shadow-sm' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Runs Table List */}
      <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
            <span className="text-sm text-slate-500 font-medium">Loading execution logs...</span>
          </div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 italic">No execution histories found.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full text-left text-xs font-sans">
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 py-4 font-semibold text-slate-600">Run ID / Timestamp</TableHead>
                  <TableHead className="px-6 py-4 font-semibold text-slate-600">Project / Scope</TableHead>
                  <TableHead className="px-6 py-4 font-semibold text-slate-600">Target Website</TableHead>
                  <TableHead className="px-6 py-4 font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="px-6 py-4 font-semibold text-slate-600 text-right">Pass Rate</TableHead>
                  <TableHead className="px-6 py-4 font-semibold text-slate-600 text-right">Duration</TableHead>
                  <TableHead className="px-6 py-4 font-semibold text-slate-600 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {runs.map((run) => {
                  const hasMetrics = !!run.metrics;
                  const failedCount = hasMetrics ? run.metrics.failedCount : 0;
                  const passRate = hasMetrics ? run.metrics.passRatePercentage : 0;
                  const isPassed = failedCount === 0;

                  return (
                    <TableRow key={run.id} className="hover:bg-slate-50/50">
                      
                      {/* ID / Timestamp */}
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-900">{run.id.slice(0, 8)}...</span>
                          <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                            {new Date(run.createdAt).toLocaleDateString()} {new Date(run.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </TableCell>

                      {/* Project Scope */}
                      <TableCell className="px-6 py-4 font-semibold text-slate-800 truncate max-w-[200px]" title={run.project?.requirementText}>
                        {run.project?.requirementText ? run.project.requirementText.slice(0, 60) + '...' : 'Unknown Project'}
                      </TableCell>

                      {/* Website */}
                      <TableCell className="px-6 py-4 text-slate-500 font-mono">
                        {run.name.includes('AI Run') ? 'https://example.com' : 'Target URL'}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] uppercase ${
                          run.status === 'RUNNING' 
                            ? 'bg-blue-50 text-blue-800 border-blue-200' 
                            : isPassed 
                            ? 'bg-green-50 text-green-800 border-green-200' 
                            : 'bg-red-50 text-red-800 border-red-200'
                        }`}>
                          {run.status === 'RUNNING' ? 'Running' : isPassed ? 'Passed' : 'Failed'}
                        </span>
                      </TableCell>

                      {/* Pass rate percentage */}
                      <TableCell className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                        {hasMetrics ? `${passRate.toFixed(0)}%` : '--'}
                      </TableCell>

                      {/* Duration */}
                      <TableCell className="px-6 py-4 text-right text-slate-500 font-mono font-semibold">
                        {hasMetrics ? `${(run.metrics.totalDurationMs / 1000).toFixed(1)}s` : '--'}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Link href={`/dashboard/execution/report/${run.id}`}>
                            <Button variant="ghost" className="h-8 py-1 px-3 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg">
                              View Report
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost"
                            onClick={() => handleReRun(run)}
                            className="p-1.5 bg-white text-slate-400 hover:text-slate-800 border border-slate-200 rounded-lg transition-colors"
                            title="Re-run Execution"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>

                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

    </div>
  );
}
