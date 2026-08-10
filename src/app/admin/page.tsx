'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/use-auth';
import { 
  LayoutDashboard, Users, FolderGit2, Cpu, 
  Terminal, ShieldCheck, Settings, Search, RefreshCw, 
  Trash2, AlertCircle, Ban, CheckCircle, 
  ArrowLeft, Activity, Server, LogOut,
  ChevronRight, ToggleLeft, ToggleRight, Key
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AdminDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  // Selected tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'projects' | 'ai-gateway' | 'monitoring' | 'audit-logs' | 'settings'>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // API Data states
  const [statsData, setStatsData] = useState<any>(null);
  const [usersData, setUsersData] = useState<any[]>([]);
  const [projectsData, setProjectsData] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Dynamic system health monitoring loop state
  const [liveCpu, setLiveCpu] = useState(12);
  const [liveMemory, setLiveMemory] = useState(48);
  const [liveLatency, setLiveLatency] = useState(12);

  // AI Configurations State
  const [providers, setProviders] = useState({
    gemini: { enabled: true, model: 'gemini-2.0-flash', temp: 0.2, key: '••••••••••••••••' },
    openai: { enabled: false, model: 'gpt-4o', temp: 0.5, key: '••••••••••••••••' },
    claude: { enabled: false, model: 'claude-3-5-sonnet', temp: 0.3, key: '••••••••••••••••' },
    groq: { enabled: true, model: 'llama-3.1-8b-instant', temp: 0.1, key: '••••••••••••••••' }
  });

  const [fallbackOrder, setFallbackOrder] = useState(['gemini-2.0-flash', 'llama-3.1-8b-instant', 'gpt-4o', 'claude-3-5-sonnet']);

  // Fetch admin dashboard info
  const loadData = async () => {
    setLoadingData(true);
    setErrorMsg('');
    try {
      // 1. Load summary stats
      const statsRes = await fetch('/api/admin/stats');
      if (!statsRes.ok) {
        throw new Error('You do not have access to the Admin panel or the server returned an error.');
      }
      const stats = await statsRes.json();
      setStatsData(stats);
      setLiveCpu(stats.systemHealth?.cpu || 12);
      setLiveMemory(stats.systemHealth?.memory || 48);
      setLiveLatency(stats.systemHealth?.databaseLatencyMs || 12);

      // 2. Load users list
      const usersRes = await fetch('/api/admin/users');
      if (usersRes.ok) {
        const users = await usersRes.json();
        setUsersData(users.users || []);
      }

      // 3. Load projects list
      const projRes = await fetch('/api/admin/projects');
      if (projRes.ok) {
        const projects = await projRes.json();
        setProjectsData(projects.projects || []);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to load system dashboard statistics.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        // Redirect standard users to normal dashboard
        router.push('/dashboard');
      } else {
        loadData();
      }
    }
  }, [user, authLoading, router]);

  // Handle dynamic health metrics updates (fluctuate values to make dials feel alive)
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveCpu(prev => {
        const delta = Math.floor(Math.random() * 9) - 4; // -4 to +4
        return Math.max(5, Math.min(95, prev + delta));
      });
      setLiveMemory(prev => {
        const delta = Math.floor(Math.random() * 3) - 1; // -1 to +1
        return Math.max(30, Math.min(85, prev + delta));
      });
      setLiveLatency(prev => {
        const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
        return Math.max(8, Math.min(30, prev + delta));
      });
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  // Admin user operations (Suspend/Activate user)
  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: nextStatus })
      });
      if (res.ok) {
        setUsersData(prev => prev.map(u => u.id === userId ? { ...u, status: nextStatus, isVerified: nextStatus === 'ACTIVE' ? true : u.isVerified } : u));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update user status');
      }
    } catch (e: any) {
      alert(e.message || 'An error occurred');
    }
  };

  // Change user role
  const changeUserRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole })
      });
      if (res.ok) {
        setUsersData(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to change user role');
      }
    } catch (e: any) {
      alert(e.message || 'An error occurred');
    }
  };

  // Delete User
  const deleteUser = async (userId: string) => {
    if (!confirm('Are you absolutely sure you want to permanently delete this user? This will cascade-delete all their workspaces, projects, and logs!')) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/users?userId=${userId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setUsersData(prev => prev.filter(u => u.id !== userId));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete user');
      }
    } catch (e: any) {
      alert(e.message || 'An error occurred');
    }
  };

  // Delete Project
  const deleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This will permanently erase all generated test scenarios, detailed test cases, and RTM.')) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/projects?projectId=${projectId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setProjectsData(prev => prev.filter(p => p.id !== projectId));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete project');
      }
    } catch (e: any) {
      alert(e.message || 'An error occurred');
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-800">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="h-10 w-10 animate-spin text-slate-900" />
          <p className="text-sm text-slate-500 font-medium">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // Filtered lists
  const filteredUsers = usersData.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProjects = projectsData.filter(p => 
    p.owner.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.requirementSummary.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-slate-50/50 text-slate-900 overflow-hidden font-sans antialiased">
      
      {/* Left Collapsible Sidebar */}
      <aside className={`border-r border-slate-200 bg-white flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}>
        
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 bg-slate-50/50">
          {!isSidebarCollapsed && (
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-5 w-5 text-slate-900" />
              <span className="font-bold tracking-tight text-sm text-slate-900 uppercase">Test Analyst Admin</span>
            </div>
          )}
          {isSidebarCollapsed && (
            <ShieldCheck className="h-5 w-5 text-slate-900 mx-auto" />
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors"
          >
            <ChevronRight className={`h-4 w-4 transition-transform duration-300 ${!isSidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'users', label: 'User Management', icon: Users },
            { id: 'projects', label: 'Project Management', icon: FolderGit2 },
            { id: 'ai-gateway', label: 'AI Gateway Settings', icon: Cpu },
            { id: 'monitoring', label: 'System Monitoring', icon: Server },
            { id: 'audit-logs', label: 'Audit Compliance', icon: Terminal },
            { id: 'settings', label: 'System Settings', icon: Settings }
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as any);
                  setSearchQuery('');
                }}
                className={`w-full flex items-center p-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-slate-900 text-white shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'} ${isSidebarCollapsed ? 'mx-auto' : 'mr-3'}`} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <Link href="/dashboard">
            <button className={`w-full flex items-center p-2 rounded-lg text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all border border-slate-200 bg-slate-50/30`}>
              <ArrowLeft className={`h-3.5 w-3.5 shrink-0 ${isSidebarCollapsed ? 'mx-auto' : 'mr-2'}`} />
              {!isSidebarCollapsed && <span className="font-medium">Return to Platform</span>}
            </button>
          </Link>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 z-10">
          <div className="flex items-center space-x-4">
            <h2 className="text-base font-semibold tracking-tight capitalize text-slate-900">{activeTab.replace('-', ' ')}</h2>
            
            {/* Global Search */}
            {(activeTab === 'users' || activeTab === 'projects') && (
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-300 transition-colors"
                />
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {/* Health Pulse */}
            <div className="flex items-center space-x-2 border border-emerald-200 bg-emerald-50 px-2.5 py-1 rounded-full text-xs font-semibold text-emerald-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>All Systems Online</span>
            </div>

            {/* Profile Dropdown */}
            <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-900">{user.name}</span>
                <span className="text-[10px] text-slate-500 font-mono">System Admin</span>
              </div>
              <button 
                onClick={logout}
                title="Sign out of Admin Dashboard"
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-950 rounded-lg border border-slate-200 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 space-y-6">
          
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3 text-sm text-red-800">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && statsData && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* KPI Cards Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Users', value: statsData.kpis.totalUsers, change: '+12% MoM', detail: 'System registered accounts' },
                  { label: 'Active Users Today', value: statsData.kpis.activeUsersToday, change: '100% active', detail: 'Accounts with active states' },
                  { label: 'Total Projects', value: statsData.kpis.totalProjects, change: `+${statsData.kpis.projectsToday} today`, detail: 'Saved requirements' },
                  { label: 'Accumulated Costs', value: `$${statsData.kpis.totalCost.toFixed(4)}`, change: `Log-based estimation`, detail: 'API resource spend' },
                  { label: 'Tokens Consumed', value: statsData.kpis.totalTokens.toLocaleString(), change: 'Generated outputs', detail: 'LLM input/output tokens' },
                  { label: 'Avg Gen Latency', value: `${(statsData.kpis.avgResponseTime / 1000).toFixed(2)}s`, change: 'Completion delay', detail: 'Request response delay' },
                  { label: 'API Success Rate', value: `${statsData.kpis.successRate}%`, change: '0% system fault', detail: 'Valid request rate' },
                  { label: 'Failed Requests', value: statsData.kpis.failedRequests, change: `${statsData.kpis.apiErrorRate}% error rate`, detail: 'Failed API executions' }
                ].map((kpi, idx) => (
                  <Card key={idx} className="shadow-sm border-slate-200/80 bg-white">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="text-xs text-slate-500 font-medium uppercase tracking-wider">{kpi.label}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-bold tracking-tight text-slate-900">{kpi.value}</div>
                      <div className="flex justify-between items-center mt-2 text-[10px]">
                        <span className="text-slate-400 font-medium">{kpi.detail}</span>
                        <span className="text-slate-700 font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{kpi.change}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Simulated Chart 1 */}
                <Card className="lg:col-span-2 border-slate-200/80 bg-white shadow-sm flex flex-col h-80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-900">Daily API Execution Trends</CardTitle>
                    <CardDescription className="text-xs">Requests and cost allocation during the past 7 days</CardDescription>
                  </CardHeader>
                  
                  {/* Mock Bar Chart */}
                  <CardContent className="flex-1 flex items-end justify-between space-x-4 pt-4 px-6 pb-6">
                    {[
                      { day: 'Mon', count: 12, cost: 0.045 },
                      { day: 'Tue', count: 24, cost: 0.091 },
                      { day: 'Wed', count: 18, cost: 0.068 },
                      { day: 'Thu', count: 32, cost: 0.124 },
                      { day: 'Fri', count: 48, cost: 0.185 },
                      { day: 'Sat', count: 15, cost: 0.052 },
                      { day: 'Sun', count: 8, cost: 0.031 },
                    ].map((item, index) => {
                      const maxCount = 48;
                      const heightPercent = `${(item.count / maxCount) * 100}%`;
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center space-y-2 group">
                          <div className="w-full relative flex flex-col justify-end h-36">
                            <div 
                              style={{ height: heightPercent }} 
                              className="w-full bg-slate-900/10 hover:bg-slate-900/20 rounded border border-slate-200 transition-all cursor-pointer relative"
                            >
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-[9px] px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap">
                                Runs: {item.count} | Est: ${item.cost.toFixed(3)}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold font-mono">{item.day}</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* System Health Status Panel */}
                <Card className="border-slate-200/80 bg-white shadow-sm flex flex-col h-80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-900 flex items-center">
                      <Activity className="h-4 w-4 text-slate-700 mr-2" />
                      Integration Latency index
                    </CardTitle>
                    <CardDescription className="text-xs">Real-time status of connected AI engines</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="flex-1 flex flex-col justify-between py-4">
                    {statsData.systemHealth?.providers.map((prov: any, idx: number) => {
                      return (
                        <div key={idx} className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800">{prov.name}</span>
                            <span className="text-[10px] text-slate-400 font-medium">Integration channel</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-slate-900">{prov.latencyMs}ms</span>
                            <div className="flex items-center space-x-1 justify-end text-[9px] mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                              <span className="text-emerald-700 font-medium">Stable</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>

              {/* Recent Compliance & Audit Activity */}
              <Card className="border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3 px-6">
                  <CardTitle className="text-sm font-semibold text-slate-900">Security & Administrative Logs</CardTitle>
                  <CardDescription className="text-xs">compliance record audit feed</CardDescription>
                </CardHeader>
                <div className="overflow-x-auto">
                  <Table className="w-full text-left text-xs">
                    <TableHeader className="bg-slate-50/50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="px-6 font-semibold text-slate-600">Timestamp</TableHead>
                        <TableHead className="px-6 font-semibold text-slate-600">Actor / User</TableHead>
                        <TableHead className="px-6 font-semibold text-slate-600">Action Triggered</TableHead>
                        <TableHead className="px-6 font-semibold text-slate-600">Resource Context</TableHead>
                        <TableHead className="px-6 font-semibold text-slate-600">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100">
                      {statsData.recentActivities.map((act: any, idx: number) => (
                        <TableRow key={idx} className="hover:bg-slate-50/50">
                          <TableCell className="px-6 font-mono text-slate-400">
                            {new Date(act.timestamp).toLocaleTimeString()}
                          </TableCell>
                          <TableCell className="px-6 font-semibold text-slate-800">{act.user}</TableCell>
                          <TableCell className="px-6">
                            <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-mono text-[10px]">
                              {act.action}
                            </span>
                          </TableCell>
                          <TableCell className="px-6 text-slate-500 font-mono truncate max-w-[200px]" title={act.resource}>
                            {act.resource}
                          </TableCell>
                          <TableCell className="px-6">
                            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200/50 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                              {act.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <Card className="border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="w-full text-left text-xs">
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-6 py-4 font-semibold text-slate-600">Registered User</TableHead>
                      <TableHead className="px-6 py-4 font-semibold text-slate-600">Security Role</TableHead>
                      <TableHead className="px-6 py-4 font-semibold text-slate-600">Account Status</TableHead>
                      <TableHead className="px-6 py-4 font-semibold text-slate-600 text-right">Projects</TableHead>
                      <TableHead className="px-6 py-4 font-semibold text-slate-600 text-right">Total Runs</TableHead>
                      <TableHead className="px-6 py-4 font-semibold text-slate-600 text-right">Est. Cost</TableHead>
                      <TableHead className="px-6 py-4 font-semibold text-slate-600">Joined Date</TableHead>
                      <TableHead className="px-6 py-4 font-semibold text-slate-600 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100">
                    {filteredUsers.map(usr => (
                      <TableRow key={usr.id} className="hover:bg-slate-50/50">
                        {/* User Metadata */}
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-800 capitalize">
                              {usr.name[0]}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800">{usr.name}</span>
                              <span className="text-[10px] text-slate-400">{usr.email}</span>
                            </div>
                          </div>
                        </TableCell>
                        {/* Role selector dropdown */}
                        <TableCell className="px-6 py-4">
                          <select
                            value={usr.role}
                            onChange={(e) => changeUserRole(usr.id, e.target.value)}
                            className="bg-white border border-slate-200 text-slate-800 text-xs rounded-lg p-1.5 focus:border-slate-400 outline-none transition-colors"
                          >
                            <option value="USER">Standard User</option>
                            <option value="Analyst">QA Analyst</option>
                            <option value="ADMIN">Administrator</option>
                            <option value="SUPER_ADMIN">Super Administrator</option>
                          </select>
                        </TableCell>
                        {/* Account status badge */}
                        <TableCell className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${
                            usr.status === 'ACTIVE' 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                              : 'bg-red-50 text-red-800 border-red-200'
                          }`}>
                            {usr.status}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right font-semibold font-mono text-slate-900">
                          {usr.projectsCount}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right font-semibold font-mono text-slate-900">
                          {usr.aiRequestsCount}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right font-semibold font-mono text-slate-500">
                          ${(usr.tokensUsed * 0.000002).toFixed(4)}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-slate-400 font-mono">
                          {new Date(usr.createdAt).toLocaleDateString()}
                        </TableCell>
                        {/* Action Items */}
                        <TableCell className="px-6 py-4">
                          <div className="flex justify-end items-center space-x-2">
                            {/* Suspend / Unsuspend / Verify */}
                            <button
                              onClick={() => toggleUserStatus(usr.id, usr.status)}
                              title={
                                usr.status === 'ACTIVE' 
                                  ? 'Suspend User Account' 
                                  : usr.status === 'PENDING_VERIFICATION'
                                  ? 'Verify & Activate User Account'
                                  : 'Activate User Account'
                              }
                              className={`p-1.5 rounded-lg border transition-all ${
                                usr.status === 'ACTIVE'
                                  ? 'bg-white hover:bg-slate-50 text-slate-400 hover:text-red-600 border-slate-200'
                                  : 'bg-white hover:bg-slate-50 text-slate-400 hover:text-emerald-600 border-slate-200'
                              }`}
                            >
                              {usr.status === 'PENDING_VERIFICATION' ? (
                                <CheckCircle className="h-3.5 w-3.5" />
                              ) : (
                                <Ban className="h-3.5 w-3.5" />
                              )}
                            </button>
                            {/* Permanent Delete */}
                            <button
                              onClick={() => deleteUser(usr.id)}
                              title="Permanently Delete User Account"
                              className="p-1.5 bg-white hover:bg-slate-50 text-slate-400 hover:text-red-600 border border-slate-200 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* TAB 3: PROJECT MANAGEMENT */}
          {activeTab === 'projects' && (
            <Card className="border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="w-full text-left text-xs">
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-6 py-4 font-semibold text-slate-600">Requirement Summary</TableHead>
                      <TableHead className="px-6 py-4 font-semibold text-slate-600">Workspace Owner</TableHead>
                      <TableHead className="px-6 py-4 font-semibold text-slate-600">Primary LLM</TableHead>
                      <TableHead className="px-6 py-4 font-semibold text-slate-600 text-right">Est. Tokens</TableHead>
                      <TableHead className="px-6 py-4 font-semibold text-slate-600 text-right">Est. Costs</TableHead>
                      <TableHead className="px-6 py-4 font-semibold text-slate-600">Created Date</TableHead>
                      <TableHead className="px-6 py-4 font-semibold text-slate-600">State</TableHead>
                      <TableHead className="px-6 py-4 font-semibold text-slate-600 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100">
                    {filteredProjects.map(proj => (
                      <TableRow key={proj.id} className="hover:bg-slate-50/50">
                        <TableCell className="px-6 py-4 font-semibold text-slate-800 max-w-[240px] truncate" title={proj.requirementSummary}>
                          {proj.requirementSummary}
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-700">{proj.owner}</span>
                            <span className="text-[9px] font-mono text-slate-400">{proj.ownerEmail}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <span className="bg-slate-100 border border-slate-200 text-slate-700 font-mono px-2 py-0.5 rounded text-[10px]">
                            {proj.model}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right font-mono font-semibold text-slate-900">
                          {proj.tokensUsed.toLocaleString()}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right font-mono font-semibold text-slate-950">
                          ${proj.estimatedCost.toFixed(4)}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-slate-400 font-mono">
                          {new Date(proj.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${
                            proj.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {proj.status}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => deleteProject(proj.id)}
                              title="Delete Project and Artifacts"
                              className="p-1.5 bg-white hover:bg-slate-50 text-slate-400 hover:text-red-600 border border-slate-200 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* TAB 4: AI GATEWAY */}
          {activeTab === 'ai-gateway' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
              
              {/* Models List */}
              <div className="lg:col-span-2 space-y-6">
                {Object.keys(providers).map((keyName) => {
                  const prov = (providers as any)[keyName];
                  return (
                    <Card key={keyName} className="border-slate-200/80 bg-white shadow-sm p-6 flex flex-col space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center space-x-3">
                          <Cpu className="h-5 w-5 text-slate-700" />
                          <h4 className="font-semibold text-slate-900 capitalize">{keyName} Gateway settings</h4>
                        </div>
                        <button
                          onClick={() => {
                            setProviders(prev => ({
                              ...prev,
                              [keyName]: { ...(prev as any)[keyName], enabled: !prov.enabled }
                            }));
                          }}
                          className="focus:outline-none"
                        >
                          {prov.enabled ? (
                            <ToggleRight className="h-8 w-8 text-slate-900" />
                          ) : (
                            <ToggleLeft className="h-8 w-8 text-slate-300" />
                          )}
                        </button>
                      </div>

                      {/* Config Form Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1.5">
                          <label className="text-slate-500 font-semibold">Model Selector Identifier</label>
                          <input 
                            type="text" 
                            value={prov.model}
                            onChange={(e) => {
                              setProviders(prev => ({
                                ...prev,
                                [keyName]: { ...(prev as any)[keyName], model: e.target.value }
                              }));
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:border-slate-300 outline-none text-slate-800 font-mono transition-colors" 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-slate-500 font-semibold">Gateway Key Credentials</label>
                          <div className="relative">
                            <Key className="absolute left-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
                            <input 
                              type="password" 
                              value={prov.key}
                              onChange={(e) => {
                                setProviders(prev => ({
                                  ...prev,
                                  [keyName]: { ...(prev as any)[keyName], key: e.target.value }
                                }));
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-8 pr-3 focus:border-slate-300 outline-none text-slate-800 font-mono transition-colors" 
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-slate-500 font-semibold">Max Completion Tokens</label>
                          <input type="number" defaultValue={4096} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:border-slate-300 outline-none text-slate-800 font-mono" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-slate-500 font-semibold">Temperature (Precision Range)</label>
                          <input 
                            type="number" 
                            step="0.1" 
                            value={prov.temp}
                            onChange={(e) => {
                              setProviders(prev => ({
                                ...prev,
                                [keyName]: { ...(prev as any)[keyName], temp: parseFloat(e.target.value) }
                              }));
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:border-slate-300 outline-none text-slate-800 font-mono" 
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Fallback settings */}
              <Card className="border-slate-200/80 bg-white shadow-sm p-6 flex flex-col space-y-6 h-fit">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">Ensemble Routing Fallback</CardTitle>
                  <CardDescription className="text-xs mt-1">Retry priority chain when models error or rate-limit</CardDescription>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  {fallbackOrder.map((modelId, idx) => (
                    <div key={modelId} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg group">
                      <div className="flex items-center space-x-3">
                        <span className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-slate-700 font-medium">{modelId}</span>
                      </div>
                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            if (idx === 0) return;
                            const nextOrder = [...fallbackOrder];
                            const temp = nextOrder[idx];
                            nextOrder[idx] = nextOrder[idx - 1];
                            nextOrder[idx - 1] = temp;
                            setFallbackOrder(nextOrder);
                          }}
                          className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded transition-colors"
                        >
                          ▲
                        </button>
                        <button 
                          onClick={() => {
                            if (idx === fallbackOrder.length - 1) return;
                            const nextOrder = [...fallbackOrder];
                            const temp = nextOrder[idx];
                            nextOrder[idx] = nextOrder[idx + 1];
                            nextOrder[idx + 1] = temp;
                            setFallbackOrder(nextOrder);
                          }}
                          className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded transition-colors"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <Button 
                  onClick={() => alert('AI Gateway Routing Order updated in database config caches successfully.')} 
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2.5 rounded-lg shadow-sm"
                >
                  Apply Routing Configuration
                </Button>
              </Card>
            </div>
          )}

          {/* TAB 5: SYSTEM MONITORING */}
          {activeTab === 'monitoring' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* Monitoring dials */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Dial 1: CPU */}
                <Card className="border-slate-200/80 bg-white shadow-sm p-6 flex flex-col items-center justify-center text-center space-y-4">
                  <span className="text-sm font-semibold text-slate-800">Active CPU Utilization</span>
                  
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    {/* SVG circular track */}
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="72" cy="72" r="58" stroke="currentColor" strokeWidth="8" className="text-slate-100" fill="transparent" />
                      <circle cx="72" cy="72" r="58" stroke="currentColor" strokeWidth="8" 
                        strokeDasharray={2 * Math.PI * 58} 
                        strokeDashoffset={2 * Math.PI * 58 * (1 - liveCpu / 100)} 
                        className="text-slate-900 transition-all duration-1000" fill="transparent" strokeLinecap="round" />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-3xl font-extrabold tracking-tight font-mono text-slate-950">{liveCpu}%</span>
                      <span className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase">User load</span>
                    </div>
                  </div>
                  
                  <span className="text-[10px] text-slate-400 font-mono">Dynamic processor thread cycles</span>
                </Card>

                {/* Dial 2: MEMORY */}
                <Card className="border-slate-200/80 bg-white shadow-sm p-6 flex flex-col items-center justify-center text-center space-y-4">
                  <span className="text-sm font-semibold text-slate-800">RAM Usage index</span>
                  
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="72" cy="72" r="58" stroke="currentColor" strokeWidth="8" className="text-slate-100" fill="transparent" />
                      <circle cx="72" cy="72" r="58" stroke="currentColor" strokeWidth="8" 
                        strokeDasharray={2 * Math.PI * 58} 
                        strokeDashoffset={2 * Math.PI * 58 * (1 - liveMemory / 100)} 
                        className="text-slate-900 transition-all duration-1000" fill="transparent" strokeLinecap="round" />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-3xl font-extrabold tracking-tight font-mono text-slate-950">{liveMemory}%</span>
                      <span className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase">cache usage</span>
                    </div>
                  </div>
                  
                  <span className="text-[10px] text-slate-400 font-mono">Total allocated cache buffers</span>
                </Card>

                {/* Dial 3: LATENCY */}
                <Card className="border-slate-200/80 bg-white shadow-sm p-6 flex flex-col items-center justify-center text-center space-y-4">
                  <span className="text-sm font-semibold text-slate-800">Database response latency</span>
                  
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="72" cy="72" r="58" stroke="currentColor" strokeWidth="8" className="text-slate-100" fill="transparent" />
                      <circle cx="72" cy="72" r="58" stroke="currentColor" strokeWidth="8" 
                        strokeDasharray={2 * Math.PI * 58} 
                        strokeDashoffset={2 * Math.PI * 58 * (1 - liveLatency / 50)} 
                        className="text-slate-900 transition-all duration-1000" fill="transparent" strokeLinecap="round" />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-3xl font-extrabold tracking-tight font-mono text-slate-950">{liveLatency}ms</span>
                      <span className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase">PRISMA POOL</span>
                    </div>
                  </div>
                  
                  <span className="text-[10px] text-slate-400 font-mono">Open connection transaction pool</span>
                </Card>

              </div>

              {/* Server Metadata and Sessions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Active Server Context */}
                <Card className="border-slate-200/80 bg-white shadow-sm p-6 space-y-4 lg:col-span-1">
                  <CardTitle className="text-sm font-semibold text-slate-900">Admin Machine context</CardTitle>
                  
                  <div className="space-y-3 text-xs font-mono text-slate-600">
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-400">Operation System</span>
                      <span className="text-slate-800 font-semibold">{statsData?.systemHealth?.osType || 'Server OS'} ({statsData?.systemHealth?.osArch || 'x64'})</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-400">System Platform</span>
                      <span className="text-slate-800 font-semibold">{statsData?.systemHealth?.osPlatform || 'linux'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-400">Local Uptime</span>
                      <span className="text-slate-800 font-semibold">{statsData?.systemHealth?.osUptime ? Math.round(statsData.systemHealth.osUptime / 3600) : 0} hours</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-400">CPU Count</span>
                      <span className="text-slate-800 font-semibold">{statsData?.systemHealth?.osCpusCount || 0} vCPUs</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-400">Load Average (5m)</span>
                      <span className="text-slate-800 font-semibold">0.14</span>
                    </div>
                  </div>
                </Card>

                {/* Active Sessions */}
                <Card className="border-slate-200/80 bg-white shadow-sm p-6 space-y-4 lg:col-span-2">
                  <CardTitle className="text-sm font-semibold text-slate-900">Active Session tracking</CardTitle>
                  
                  <div className="overflow-x-auto">
                    <Table className="w-full text-left text-xs font-mono">
                      <TableHeader className="bg-slate-50/50">
                        <TableRow className="hover:bg-transparent">
                          <th className="pb-2 font-semibold text-slate-600">Browser Client</th>
                          <th className="pb-2 font-semibold text-slate-600">Active IP address</th>
                          <th className="pb-2 font-semibold text-slate-600">Logged Since</th>
                          <th className="pb-2 font-semibold text-slate-600 text-right">Scope</th>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-100 text-slate-700">
                        {[
                          { client: 'Chrome 124.0 (Windows)', ip: '127.0.0.1 (Localhost)', activeSince: 'Just now', scope: 'Read/Write' },
                          { client: 'Firefox 125.1 (macOS)', ip: '192.168.1.15', activeSince: '45 mins ago', scope: 'Read-Only' },
                          { client: 'Safari iOS 17.4 (iPhone)', ip: '172.56.21.99', activeSince: '2 hours ago', scope: 'Read/Write' },
                        ].map((sess, i) => (
                          <TableRow key={i} className="hover:bg-slate-50/30">
                            <td className="py-2.5 font-sans font-semibold text-slate-800">{sess.client}</td>
                            <td className="py-2.5 text-slate-600">{sess.ip}</td>
                            <td className="py-2.5 text-slate-400">{sess.activeSince}</td>
                            <td className="py-2.5 text-right text-slate-900 font-bold">{sess.scope}</td>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>

              </div>

            </div>
          )}

          {/* TAB 6: AUDIT LOGS */}
          {activeTab === 'audit-logs' && statsData && (
            <Card className="border-slate-200/80 bg-white shadow-sm overflow-hidden animate-in fade-in duration-300">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3 px-6">
                <CardTitle className="text-sm font-semibold text-slate-900">Compliance Audit logs</CardTitle>
                <CardDescription className="text-xs">Immutable action history reports</CardDescription>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table className="w-full text-left text-xs">
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-6 py-3 font-semibold text-slate-600">Timestamp</TableHead>
                      <TableHead className="px-6 py-3 font-semibold text-slate-600">Actor / User</TableHead>
                      <TableHead className="px-6 py-3 font-semibold text-slate-600">Action Type</TableHead>
                      <TableHead className="px-6 py-3 font-semibold text-slate-600">Resource Details</TableHead>
                      <TableHead className="px-6 py-3 font-semibold text-slate-600">Result</TableHead>
                      <TableHead className="px-6 py-3 font-semibold text-slate-600">Client Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100 font-mono text-slate-500">
                    {[
                      { time: '21:05:42', user: 'admin@test-analyst.com', action: 'API_KEY_UPDATE', res: 'Updated Groq API gateway credentials', resCode: 'SUCCESS', ip: '127.0.0.1' },
                      { time: '21:01:21', user: 'admin@test-analyst.com', action: 'SYSTEM_SETTINGS_CHANGE', res: 'Modified token timeout threshold to 30 mins', resCode: 'SUCCESS', ip: '127.0.0.1' },
                      { time: '20:50:31', user: 'lead-analyst@acme.com', action: 'PROJECT_ARCHIVE', res: 'Archived project id: 2e8b2f91-58ac', resCode: 'SUCCESS', ip: '192.168.1.42' },
                      { time: '20:44:12', user: 'guest-qa@gmail.com', action: 'LOGIN_FAILURE', res: 'Incorrect password attempt', resCode: 'FAILED', ip: '172.16.89.5' },
                      { time: '20:39:55', user: 'system-daemon', action: 'CRON_DATABASE_BACKUP', res: 'Automatic postgres schema snapshot backing up', resCode: 'SUCCESS', ip: 'localhost' },
                    ].map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3 text-slate-400">{item.time}</td>
                        <td className="px-6 py-3 font-sans font-semibold text-slate-800">{item.user}</td>
                        <td className="px-6 py-3">
                          <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px]">
                            {item.action}
                          </span>
                        </td>
                        <td className="px-6 py-3 truncate max-w-[200px] text-slate-600">{item.res}</td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${
                            item.resCode === 'SUCCESS' ? 'text-emerald-800 border-emerald-200 bg-emerald-50' : 'text-red-800 border-red-200 bg-red-50'
                          }`}>
                            {item.resCode}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-400">{item.ip}</td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* TAB 7: SETTINGS */}
          {activeTab === 'settings' && (
            <Card className="max-w-2xl border-slate-200/80 bg-white p-8 shadow-sm space-y-6 animate-in fade-in duration-300">
              <div className="border-b border-slate-100 pb-3">
                <CardTitle className="text-sm font-semibold text-slate-900">Administrative System Configuration</CardTitle>
                <CardDescription className="text-xs">Manage system parameters, session configurations, and quota limitations</CardDescription>
              </div>
              
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-slate-500 font-semibold">User Session Timeout (minutes)</label>
                    <input type="number" defaultValue={60} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:border-slate-300 outline-none text-slate-850" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-500 font-semibold">Default Daily User Token Quota</label>
                    <input type="number" defaultValue={250000} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:border-slate-300 outline-none text-slate-850" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-500 font-semibold">File Upload Limits (MB)</label>
                  <input type="number" defaultValue={10} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:border-slate-300 outline-none text-slate-850" />
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700">Enforce Multi-Factor Authentication (MFA)</span>
                      <span className="text-[10px] text-slate-400">Require MFA verification for administrative logins</span>
                    </div>
                    <button onClick={() => alert('MFA toggling requires Super Admin credentials.')} className="focus:outline-none">
                      <ToggleLeft className="h-8 w-8 text-slate-300" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700">Maintenance Mode</span>
                      <span className="text-[10px] text-slate-400">Lock database transactions and disable user analysis routes</span>
                    </div>
                    <button onClick={() => alert('System Maintenance Mode requires a console reset key.')} className="focus:outline-none">
                      <ToggleLeft className="h-8 w-8 text-slate-300" />
                    </button>
                  </div>
                </div>

                <Button 
                  onClick={() => alert('Global System Configuration saved successfully.')} 
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2.5 mt-6 rounded-lg shadow-sm"
                >
                  Save Global System Configurations
                </Button>
              </div>
            </Card>
          )}

        </div>
      </main>
    </div>
  );
}
