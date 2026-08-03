"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Copy, Trash2, Save, X, AlertTriangle } from "lucide-react";
import { storage } from "@/lib/storage";

// The exact structure of our test case objects
export interface TestCase {
  test_case_id: string;
  type: string;
  summary: string;
  expected_result: string;
  priority: string;
  
  // Optional legacy fields for backward compatibility with old projects
  title?: string;
  scenario_id?: string;
  preconditions?: string;
  steps?: string[];
}

// A small mock array if no initial data is provided
const MOCK_TEST_CASES: TestCase[] = [
  {
    test_case_id: "TC-001",
    type: "Functional",
    summary: "Verify successful user login with valid credentials.",
    expected_result: "User is redirected to the dashboard.",
    priority: "High"
  },
  {
    test_case_id: "TC-002",
    type: "Negative",
    summary: "Verify login fails with invalid password.",
    expected_result: "Error message 'Invalid credentials' is displayed.",
    priority: "Medium"
  }
];

interface TestCaseEditorProps {
  projectId?: string;
  initialTestCases?: TestCase[];
  onSaveCompleted?: () => void;
}

export function TestCaseEditor({ projectId, initialTestCases, onSaveCompleted }: TestCaseEditorProps) {
  const [testCases, setTestCases] = useState<TestCase[]>(initialTestCases || MOCK_TEST_CASES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TestCase | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // Update local state if props change (e.g. data is loaded from API)
  useEffect(() => {
    if (initialTestCases) {
      setTestCases(initialTestCases);
    }
  }, [initialTestCases]);

  const handleAdd = () => {
    const newId = `TC-NEW-${Date.now()}`;
    const newTestCase: TestCase = {
      test_case_id: newId,
      type: "Functional",
      summary: "New Test Case Summary",
      expected_result: "",
      priority: "Medium"
    };
    // Add to the top of the list and enter edit mode
    setTestCases([newTestCase, ...testCases]);
    setEditingId(newId);
    setEditForm(newTestCase);
  };

  const handleEdit = (tc: TestCase) => {
    setEditingId(tc.test_case_id);
    // Deep clone the object so we don't mutate state directly
    setEditForm(JSON.parse(JSON.stringify(tc)));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = () => {
    if (!editForm) return;
    setTestCases((prev) => 
      prev.map((tc) => tc.test_case_id === editingId ? editForm : tc)
    );
    setEditingId(null);
    setEditForm(null);
  };

  const handleDuplicate = (tc: TestCase) => {
    const duplicated: TestCase = JSON.parse(JSON.stringify(tc));
    duplicated.test_case_id = `TC-COPY-${Date.now()}`;
    
    // If it's a legacy test case without summary, append to title instead
    if (duplicated.summary) {
      duplicated.summary = `${duplicated.summary} (Copy)`;
    } else if (duplicated.title) {
      duplicated.title = `${duplicated.title} (Copy)`;
    }
    
    // Find index of original and insert right after it
    const index = testCases.findIndex(t => t.test_case_id === tc.test_case_id);
    const newTestCases = [...testCases];
    newTestCases.splice(index + 1, 0, duplicated);
    setTestCases(newTestCases);
  };

  const confirmDelete = (id: string) => {
    setPendingDelete(id);
  };

  const executeDelete = () => {
    if (pendingDelete) {
      setTestCases((prev) => prev.filter(tc => tc.test_case_id !== pendingDelete));
      setPendingDelete(null);
    }
  };

  // Form field update handlers
  const updateFormField = (field: keyof TestCase, value: any) => {
    if (editForm) {
      setEditForm({ ...editForm, [field]: value });
    }
  };

  // Persist all changes to database
  const saveToDatabase = async () => {
    if (!projectId) {
      alert("No project ID found to save to.");
      return;
    }
    
    setIsSaving(true);
    try {
      const existingProject = await storage.getProject(projectId);
      if (existingProject && existingProject.testCases) {
        const updatedTestCasesObject = {
          ...existingProject.testCases,
          test_cases: testCases
        };
        await storage.updateArtifact(projectId, existingProject.requirementText, 'testCases', updatedTestCasesObject);
      }
      if (onSaveCompleted) {
        onSaveCompleted();
      }
    } catch (e) {
      console.error(e);
      alert("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    const p = (priority || "").toLowerCase();
    if (p === 'high') return 'bg-red-100 text-red-800';
    if (p === 'medium') return 'bg-yellow-100 text-yellow-800';
    if (p === 'low') return 'bg-blue-100 text-blue-800';
    return 'bg-slate-100 text-slate-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border">
        <div>
          <h2 className="text-lg font-bold">Interactive Test Case Editor</h2>
          <p className="text-sm text-muted-foreground">Manage and refine AI-generated test cases.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleAdd} variant="outline" className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Test Case
          </Button>
          <Button onClick={saveToDatabase} disabled={isSaving} className="flex items-center gap-2">
            <Save className="w-4 h-4" /> {isSaving ? "Saving..." : "Save to Project"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {testCases.map((tc) => {
          const isEditing = editingId === tc.test_case_id;

          if (isEditing && editForm) {
            // EDIT MODE
            return (
              <Card key={tc.test_case_id} className="border-blue-500 shadow-md">
                <CardHeader className="bg-muted/20 pb-4 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-blue-600">Editing Test Case</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold">Test Case ID</label>
                      <Input value={editForm.test_case_id} onChange={e => updateFormField('test_case_id', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold">Type</label>
                      <Input value={editForm.type} onChange={e => updateFormField('type', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold">Priority</label>
                      <Select 
                        value={editForm.priority || "Medium"} 
                        onValueChange={val => updateFormField('priority', val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Summary</label>
                    <Input 
                      value={editForm.summary || editForm.title || ""} 
                      onChange={e => updateFormField('summary', e.target.value)} 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Expected Result</label>
                    <Textarea value={editForm.expected_result} onChange={e => updateFormField('expected_result', e.target.value)} className="min-h-[80px]" />
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/20 border-t pt-4 flex justify-end gap-2">
                  <Button variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
                  <Button onClick={handleSaveEdit}>Done</Button>
                </CardFooter>
              </Card>
            );
          }

          // READ-ONLY MODE
          return (
            <Card key={tc.test_case_id} className="group hover:border-slate-400 transition-colors">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  
                  {/* Left Column: Metadata */}
                  <div className="md:w-1/4 space-y-3 border-r pr-4">
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Test Case</div>
                      <div className="font-mono font-bold text-sm bg-muted inline-block px-2 py-1 rounded">{tc.test_case_id}</div>
                    </div>
                    
                    {tc.scenario_id && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Scenario (Legacy)</div>
                        <div className="text-sm font-medium">{tc.scenario_id}</div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Type</div>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tc.type.toLowerCase().includes('negative') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {tc.type}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Priority</div>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getPriorityColor(tc.priority)}`}>
                          {tc.priority || "Not Set"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Content */}
                  <div className="md:w-3/4 space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Summary</div>
                        <h3 className="text-base font-semibold leading-tight">{tc.summary || tc.title}</h3>
                      </div>
                      
                      {/* Action Buttons (Visible on hover) */}
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 bg-background shadow-sm border rounded-md p-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleEdit(tc)} title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-slate-700 hover:bg-slate-50" onClick={() => handleDuplicate(tc)} title="Duplicate">
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => confirmDelete(tc.test_case_id)} title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {tc.preconditions && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Preconditions (Legacy)</div>
                        <div className="text-sm bg-slate-50 p-2 rounded whitespace-pre-wrap">{tc.preconditions}</div>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                      {tc.steps && (Array.isArray(tc.steps) ? tc.steps.length > 0 : typeof tc.steps === 'string') && (
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Steps (Legacy)</div>
                          {Array.isArray(tc.steps) ? (
                            <ol className="list-decimal list-inside text-sm space-y-1">
                              {tc.steps.map((step, idx) => (
                                <li key={idx} className="leading-snug">{step}</li>
                              ))}
                            </ol>
                          ) : (
                            <div className="text-sm whitespace-pre-wrap">{tc.steps}</div>
                          )}
                        </div>
                      )}
                       <div className={!(tc.steps && (Array.isArray(tc.steps) ? tc.steps.length > 0 : typeof tc.steps === 'string')) ? "md:col-span-2" : ""}>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Expected Result</div>
                        <div className="text-sm font-medium text-emerald-700 whitespace-pre-wrap leading-snug">
                          {tc.expected_result}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>

              {/* Delete Confirmation Overlay */}
              {pendingDelete === tc.test_case_id && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg border-2 border-red-500 z-10">
                  <div className="bg-card p-6 rounded-lg shadow-xl text-center space-y-4 max-w-sm mx-4">
                    <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <h4 className="text-lg font-bold">Delete Test Case?</h4>
                    <p className="text-sm text-muted-foreground">This action cannot be undone. Are you sure you want to remove this test case?</p>
                    <div className="flex justify-center gap-3 pt-2">
                      <Button variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button>
                      <Button variant="destructive" onClick={executeDelete}>Yes, delete it</Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        
        {testCases.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
            <h3 className="text-lg font-semibold text-muted-foreground">No test cases found.</h3>
            <Button onClick={handleAdd} variant="outline" className="mt-4">
              <Plus className="w-4 h-4 mr-2" /> Add the first one
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
