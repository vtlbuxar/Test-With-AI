"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { storage, Project } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle, AlertTriangle, Star, LogOut, User } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { TestCaseEditor } from "@/components/dashboard/test-case-editor";
import { useAuth } from "@/lib/use-auth";
import { AIUsageCenter } from "@/components/dashboard/ai-usage-center";

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    if (typeof id === 'string') {
      storage.getProject(id).then(p => {
        if (!isSubscribed) return;
        if (p) {
          setProject(p);
        } else {
          router.push('/dashboard');
        }
      });
    }
    setMounted(true);
    return () => { isSubscribed = false; };
  }, [id, router]);

  if (!mounted || !project) return null;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Requirement Details</h1>
            <p className="text-sm text-muted-foreground">
              Created on {new Date(project.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AIUsageCenter />
          <Link href="/dashboard/execution">
            <Button variant="outline" className="border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-800 font-semibold flex items-center gap-1.5">
              <span>Execute Test Cases ⭐</span>
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

      {/* Requirement Context */}
      <Card className="border-l-4 border-l-slate-500">
        <CardHeader>
          <CardTitle>Source Requirement</CardTitle>
          <CardDescription>The original input used to generate these artifacts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-medium text-sm">
            {project.requirementText}
          </div>
        </CardContent>
      </Card>

      {/* Analysis */}
      {project.analysis && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle>Requirement Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{project.analysis.requirement_analysis}</p>
          </CardContent>
        </Card>
      )}

      {/* Scenarios */}
      {project.scenarios && (
        <Card className="border-l-4 border-l-indigo-500">
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
                {project.scenarios.test_scenarios.map((scenario: any) => (
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
          </CardContent>
        </Card>
      )}

      {/* Test Cases */}
      {project.testCases && (
        <div className="space-y-8">
          <Card className="border-l-4 border-l-yellow-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Test Case Quality Score 
                <div className="flex text-yellow-500">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className={`w-5 h-5 ${star * 20 <= project.testCases.quality_score.overall_score_percentage ? 'fill-current' : ''}`} />
                  ))}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold">{project.testCases.quality_score.overall_score_percentage}%</div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>Requirement coverage: {project.testCases.quality_score.requirement_coverage_percentage}%</div>
                  <div>Duplicate test cases: {project.testCases.quality_score.duplicate_count}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
                {[
                  { key: 'positive_coverage', label: 'Positive Coverage' },
                  { key: 'negative_coverage', label: 'Negative Coverage' },
                  { key: 'boundary_coverage', label: 'Boundary Coverage' },
                  { key: 'security_coverage', label: 'Security Coverage' },
                  { key: 'accessibility_coverage', label: 'Accessibility Coverage' },
                  { key: 'api_validation', label: 'API Validation' },
                ].map(({ key, label }) => {
                  const isCovered = project.testCases.quality_score.coverage_breakdown[key];
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

          <TestCaseEditor 
            projectId={project.id} 
            initialTestCases={project.testCases.test_cases} 
          />
        </div>
      )}

      {/* RTM */}
      {project.rtm && (
        <Card className="border-l-4 border-l-purple-600">
          <CardHeader>
            <CardTitle>Requirement Traceability Matrix</CardTitle>
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
                {project.rtm.rtm.map((item: any, index: number) => (
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
                        {item.testable_items.map((testItem: string, i: number) => (
                          <li key={i}>{testItem}</li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Suites */}
      {project.suites && (
        <Card className="border-l-4 border-l-teal-500">
          <CardHeader>
            <CardTitle>Smoke & Regression Test Suites</CardTitle>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {project.suites.smoke_tests.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.test_case_id}</TableCell>
                        <TableCell>{item.type}</TableCell>
                        <TableCell>{item.priority || "Medium"}</TableCell>
                        <TableCell className={item.risk_level === 'High' ? 'text-red-500 font-bold' : item.risk_level === 'Low' ? 'text-green-600' : 'text-yellow-600'}>
                          {item.risk_level || "Medium"}
                        </TableCell>
                        <TableCell className="whitespace-pre-wrap">{item.summary || item.title || ""}</TableCell>
                        <TableCell className="whitespace-pre-wrap">{item.steps || ""}</TableCell>
                        <TableCell className="whitespace-pre-wrap">{item.expected_result}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-pre-wrap">{item.justification || ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {project.suites.regression_tests.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.test_case_id}</TableCell>
                        <TableCell>{item.type}</TableCell>
                        <TableCell>{item.priority || "Medium"}</TableCell>
                        <TableCell className={item.risk_level === 'High' ? 'text-red-500 font-bold' : item.risk_level === 'Low' ? 'text-green-600' : 'text-yellow-600'}>
                          {item.risk_level || "Medium"}
                        </TableCell>
                        <TableCell className="whitespace-pre-wrap">{item.summary || item.title || ""}</TableCell>
                        <TableCell className="whitespace-pre-wrap">{item.steps || ""}</TableCell>
                        <TableCell className="whitespace-pre-wrap">{item.expected_result}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-pre-wrap">{item.justification || ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
