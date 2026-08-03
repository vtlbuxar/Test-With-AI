"use client";

import { useEffect, useState } from "react";
import { Project, storage } from "@/lib/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderGit2, Calendar, ArrowRight, Trash2, ChevronDown, ChevronUp, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/use-auth";
import { AIUsageCenter } from "@/components/dashboard/ai-usage-center";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [mounted, setMounted] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadProjects();
    setMounted(true);
  }, []);

  const loadProjects = async () => {
    const data = await storage.getProjects();
    setProjects(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this requirement?")) {
      await storage.deleteProject(id);
      loadProjects();
    }
  };

  const toggleDate = (dateKey: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateKey]: !prev[dateKey]
    }));
  };

  if (!mounted) return null; // Avoid hydration mismatch

  // Group projects by date
  const groupedProjects = projects.reduce((groups, project) => {
    const dateObj = new Date(project.createdAt);
    const dateKey = `${dateObj.getDate()}-${dateObj.getMonth() + 1}-${dateObj.getFullYear()}`;
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(project);
    return groups;
  }, {} as Record<string, Project[]>);

  const sortedDateKeys = Object.keys(groupedProjects).sort((a, b) => {
    const [d1, m1, y1] = a.split('-').map(Number);
    const [d2, m2, y2] = b.split('-').map(Number);
    return new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime();
  });

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Requirements Dashboard</h1>
          <p className="text-muted-foreground">Manage and view your generated test assets.</p>
        </div>
        <div className="flex items-center gap-3">
          <AIUsageCenter />
          <Link href="/">
            <Button variant="outline">
              + New Analysis
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

      {projects.length === 0 ? (
        <Card className="text-center p-12 border-dashed">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-primary/10 rounded-full">
              <FolderGit2 className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">No requirements yet</h2>
            <p className="text-muted-foreground max-w-sm">
              You haven't saved any test artifacts yet. Go back to the generator to analyze a requirement and save your work!
            </p>
            <Link href="/">
              <Button className="mt-4">Start New Analysis</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDateKeys.map(dateKey => (
            <div key={dateKey} className="border rounded-lg overflow-hidden bg-card text-card-foreground shadow-sm">
              <button 
                onClick={() => toggleDate(dateKey)}
                className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-lg">{dateKey}</span>
                  <span className="text-sm text-muted-foreground ml-2">({groupedProjects[dateKey].length} items)</span>
                </div>
                {expandedDates[dateKey] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              
              {expandedDates[dateKey] && (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-background">
                  {groupedProjects[dateKey].map(project => (
                    <Card key={project.id} className="flex flex-col hover:shadow-md transition-shadow group border-muted">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <FolderGit2 className="w-5 h-5 text-primary" />
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDelete(project.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <CardTitle className="line-clamp-2 mt-4 text-lg leading-snug">
                          {project.requirementText}
                        </CardTitle>
                        <CardDescription className="flex items-center mt-2">
                          {new Date(project.createdAt).toLocaleTimeString('en-IN', { timeStyle: 'short' })}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <div className="flex flex-wrap gap-2">
                          {project.analysis && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium dark:bg-blue-900/30 dark:text-blue-300">Analysis</span>}
                          {project.scenarios && <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full font-medium dark:bg-indigo-900/30 dark:text-indigo-300">Scenarios</span>}
                          {project.testCases && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium dark:bg-yellow-900/30 dark:text-yellow-300">Test Cases</span>}
                          {project.rtm && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-medium dark:bg-purple-900/30 dark:text-purple-300">RTM</span>}
                          {project.suites && <span className="text-xs bg-teal-100 text-teal-800 px-2 py-1 rounded-full font-medium dark:bg-teal-900/30 dark:text-teal-300">Suites</span>}
                        </div>
                      </CardContent>
                      <CardFooter className="pt-4 border-t">
                        <Link href={`/dashboard/${project.id}`} className="w-full">
                          <Button variant="ghost" className="w-full justify-between group-hover:bg-primary/5">
                            View Details
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
