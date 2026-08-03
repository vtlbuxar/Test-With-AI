'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/use-auth';
import { 
  LayoutDashboard, Users, FolderGit2, Cpu, LineChart, 
  Terminal, ShieldCheck, Settings, Search, RefreshCw, 
  Trash2, Edit, AlertCircle, Ban, CheckCircle, Database, 
  ArrowLeft, ArrowRight, Activity, Server, Clock, LogOut,
  ChevronRight, ToggleLeft, ToggleRight, Info, AlertTriangle, Key, Plus
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// HSL theme helper for risk priority
const getRiskBadgeColor = (risk: string) => {
  const r = risk?.toLowerCase();
  if (r === 'high') return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (r === 'low') return 'bg-green-500/10 text-green-500 border-green-500/20';
  return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
};

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
  const [healthTimer, setHealthTimer] = useState<any>(null);
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
      if (!user || (user.role !== 'Analyst' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
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
        setUsersData(prev => prev.map(u => u.id === userId ? { ...u, status: nextStatus } : u));
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
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="h-10 w-10 animate-spin text-teal-500" />
          <p className="text-sm text-zinc-400">Loading system administration console...</p>
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
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      
      {/* 1. Left Collapsible Sidebar */}
      <aside className={`border-r border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}>
        
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800/80">
          {!isSidebarCollapsed && (
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-6 w-6 text-teal-500" />
              <span className="font-bold tracking-tight text-sm">TEST ANALYST ADMIN</span>
            </div>
          )}
          {isSidebarCollapsed && (
            <ShieldCheck className="h-6 w-6 text-teal-500 mx-auto" />
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="text-zinc-500 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800"
          >
            <ChevronRight className={`h-4 w-4 transition-transform duration-300 ${!isSidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
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
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-teal-400' : 'text-zinc-500'} ${isSidebarCollapsed ? 'mx-auto' : 'mr-3'}`} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/40">
          <Link href="/dashboard">
            <button className={`w-full flex items-center p-2 rounded text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30 transition-all`}>
              <ArrowLeft className={`h-3.5 w-3.5 shrink-0 ${isSidebarCollapsed ? 'mx-auto' : 'mr-2'}`} />
              {!isSidebarCollapsed && <span>Return to Platform</span>}
            </button>
          </Link>
        </div>
      </aside>

      {/* 2. Main Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md flex items-center justify-between px-6 z-10">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold tracking-tight capitalize">{activeTab.replace('-', ' ')}</h2>
            
            {/* Global Search */}
            {(activeTab === 'users' || activeTab === 'projects') && (
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-1.5 pl-9 pr-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                />
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {/* Health Pulse */}
            <div className="flex items-center space-x-2 border border-green-500/20 bg-green-500/5 px-2.5 py-1 rounded-full text-xs font-semibold text-green-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span>All Systems Online</span>
            </div>

            {/* Profile Dropdown */}
            <div className="flex items-center gap-3 border-l border-zinc-800 pl-4">
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold">{user.name}</span>
                <span className="text-[10px] text-zinc-500 font-mono">System Administrator</span>
              </div>
              <button 
                onClick={logout}
                title="Sign out of Admin Dashboard"
                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 rounded-lg border border-zinc-800 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 bg-zinc-950 space-y-8">
          
          {errorMsg && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center space-x-3 text-sm text-red-400">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && statsData && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* KPI Cards Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Users', value: statsData.kpis.totalUsers, change: '+12% MoM', detail: 'Total system accounts' },
                  { label: 'Active Users Today', value: statsData.kpis.activeUsersToday, change: '100% capacity', detail: 'Users marked active' },
                  { label: 'Total Projects', value: statsData.kpis.totalProjects, change: `+${statsData.kpis.projectsToday} today`, detail: 'Requirements generated' },
                  { label: 'Accumulated Costs', value: `$${statsData.kpis.totalCost.toFixed(4)}`, change: `Based on usage logs`, detail: 'Est. provider API cost' },
                  { label: 'Tokens Consumed', value: statsData.kpis.totalTokens.toLocaleString(), change: 'Accumulated output', detail: 'System tokens consumed' },
                  { label: 'Avg Gen Latency', value: `${(statsData.kpis.avgResponseTime / 1000).toFixed(2)}s`, change: 'Optimal execution', detail: 'LLM completion time' },
                  { label: 'API Success Rate', value: `${statsData.kpis.successRate}%`, change: '0.0% critical failure', detail: 'Request completion rate' },
                  { label: 'Failed Requests', value: statsData.kpis.failedRequests, change: `${statsData.kpis.apiErrorRate}% error rate`, detail: 'Failed LLM calls' }
                ].map((kpi, idx) => (
                  <div key={idx} className="bg-zinc-900/40 border border-zinc-800/80 p-5 rounded-xl hover:border-zinc-700/80 transition-all group">
                    <span className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">{kpi.label}</span>
                    <div className="text-2xl font-bold tracking-tight mt-1">{kpi.value}</div>
                    <div className="flex justify-between items-center mt-3 text-[10px]">
                      <span className="text-zinc-400 font-medium">{kpi.detail}</span>
                      <span className="text-teal-400 font-mono bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20">{kpi.change}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Simulated Chart 1 */}
                <div className="lg:col-span-2 bg-zinc-900/20 border border-zinc-800/80 p-6 rounded-xl flex flex-col h-80">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h4 className="text-sm font-semibold">Daily AI Requests & Cost Projection</h4>
                      <p className="text-xs text-zinc-500">LLM completions triggered over the last 7 days</p>
                    </div>
                    <span className="text-xs text-zinc-400 font-mono bg-zinc-800 px-2.5 py-1 rounded">Live Data Feed</span>
                  </div>
                  
                  {/* Mock Bar Chart */}
                  <div className="flex-1 flex items-end justify-between space-x-4 pt-4">
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
                              className="w-full bg-gradient-to-t from-teal-600/40 to-teal-400/80 rounded group-hover:from-teal-500 group-hover:to-teal-300 transition-all cursor-pointer relative"
                            >
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-zinc-900 border border-zinc-700 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap">
                                Runs: {item.count} | Est: ${item.cost.toFixed(3)}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 font-mono">{item.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* System Health Status Panel */}
                <div className="bg-zinc-900/20 border border-zinc-800/80 p-6 rounded-xl flex flex-col h-80">
                  <h4 className="text-sm font-semibold mb-4 flex items-center">
                    <Activity className="h-4 w-4 text-teal-400 mr-2" />
                    Integration Latency Index
                  </h4>
                  
                  <div className="flex-1 flex flex-col justify-between space-y-4">
                    {statsData.systemHealth?.providers.map((prov: any, idx: number) => {
                      const latencyColor = prov.latencyMs > 300 ? 'text-yellow-400' : 'text-green-400';
                      return (
                        <div key={idx} className="flex items-center justify-between border-b border-zinc-800/40 pb-2 text-xs">
                          <div className="flex flex-col">
                            <span className="font-semibold text-zinc-300">{prov.name}</span>
                            <span className="text-[10px] text-zinc-500">Service integration channel</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-zinc-300">{prov.latencyMs}ms</span>
                            <div className="flex items-center space-x-1 justify-end text-[9px] mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>
                              <span className="text-zinc-500">Stable</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Recent Compliance & Audit Activity */}
              <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Security & Administrative Logs</h4>
                  <span className="text-xs text-teal-400 font-mono font-bold">10 Most Recent Actions</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500">
                        <th className="px-6 py-3 font-semibold">Timestamp</th>
                        <th className="px-6 py-3 font-semibold">Actor / User</th>
                        <th className="px-6 py-3 font-semibold">Action Triggered</th>
                        <th className="px-6 py-3 font-semibold">Resource Context</th>
                        <th className="px-6 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {statsData.recentActivities.map((act: any, idx: number) => (
                        <tr key={idx} className="hover:bg-zinc-900/20 transition-colors">
                          <td className="px-6 py-3 font-mono text-zinc-500">
                            {new Date(act.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="px-6 py-3 font-semibold text-zinc-300">{act.user}</td>
                          <td className="px-6 py-3">
                            <span className="bg-zinc-800 text-zinc-300 border border-zinc-700/60 px-2 py-0.5 rounded font-mono">
                              {act.action}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-zinc-400 font-mono truncate max-w-[200px]" title={act.resource}>
                            {act.resource}
                          </td>
                          <td className="px-6 py-3">
                            <span className="text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full font-bold">
                              {act.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-500">
                        <th className="px-6 py-4 font-semibold">Registered User</th>
                        <th className="px-6 py-4 font-semibold">Security Role</th>
                        <th className="px-6 py-4 font-semibold">Account Status</th>
                        <th className="px-6 py-4 font-semibold text-right">Projects</th>
                        <th className="px-6 py-4 text-right font-semibold">Total Runs</th>
                        <th className="px-6 py-4 text-right font-semibold">Est. Cost</th>
                        <th className="px-6 py-4 font-semibold">Joined Date</th>
                        <th className="px-6 py-4 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {filteredUsers.map(usr => (
                        <tr key={usr.id} className="hover:bg-zinc-900/20 transition-colors">
                          {/* User Metadata */}
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center font-bold text-teal-400 capitalize">
                                {usr.name[0]}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-semibold text-zinc-200">{usr.name}</span>
                                <span className="text-[10px] text-zinc-500">{usr.email}</span>
                              </div>
                            </div>
                          </td>
                          {/* Role selector dropdown */}
                          <td className="px-6 py-4">
                            <select
                              value={usr.role}
                              onChange={(e) => changeUserRole(usr.id, e.target.value)}
                              className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded p-1.5 focus:border-zinc-700 outline-none"
                            >
                              <option value="USER">Standard User</option>
                              <option value="Analyst">QA Analyst</option>
                              <option value="ADMIN">Administrator</option>
                              <option value="SUPER_ADMIN">Super Administrator</option>
                            </select>
                          </td>
                          {/* Account status badge */}
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-full font-bold border ${
                              usr.status === 'ACTIVE' 
                                ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {usr.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-semibold font-mono text-zinc-300">
                            {usr.projectsCount}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold font-mono text-zinc-300">
                            {usr.aiRequestsCount}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold font-mono text-zinc-400">
                            ${(usr.tokensUsed * 0.000002).toFixed(4)}
                          </td>
                          <td className="px-6 py-4 text-zinc-500 font-mono">
                            {new Date(usr.createdAt).toLocaleDateString()}
                          </td>
                          {/* Action Items */}
                          <td className="px-6 py-4">
                            <div className="flex justify-end items-center space-x-2">
                              {/* Suspend / Unsuspend */}
                              <button
                                onClick={() => toggleUserStatus(usr.id, usr.status)}
                                title={usr.status === 'ACTIVE' ? 'Suspend User Account' : 'Activate User Account'}
                                className={`p-1.5 rounded border transition-colors ${
                                  usr.status === 'ACTIVE'
                                    ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 border-zinc-800'
                                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-green-400 border-zinc-800'
                                }`}
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                              {/* Permanent Delete */}
                              <button
                                onClick={() => deleteUser(usr.id)}
                                title="Permanently Delete User Account"
                                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-500 border border-zinc-800 rounded transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PROJECT MANAGEMENT */}
          {activeTab === 'projects' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-500">
                        <th className="px-6 py-4 font-semibold">Requirement Summary</th>
                        <th className="px-6 py-4 font-semibold">Workspace Owner</th>
                        <th className="px-6 py-4 font-semibold">Primary LLM Configuration</th>
                        <th className="px-6 py-4 text-right font-semibold">Est. Tokens</th>
                        <th className="px-6 py-4 text-right font-semibold">Est. Costs</th>
                        <th className="px-6 py-4 font-semibold">Created Date</th>
                        <th className="px-6 py-4 font-semibold">State</th>
                        <th className="px-6 py-4 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {filteredProjects.map(proj => (
                        <tr key={proj.id} className="hover:bg-zinc-900/20 transition-colors">
                          <td className="px-6 py-4 font-semibold text-zinc-200 max-w-[240px] truncate" title={proj.requirementSummary}>
                            {proj.requirementSummary}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-zinc-300">{proj.owner}</span>
                              <span className="text-[9px] font-mono text-zinc-500">{proj.ownerEmail}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-zinc-800 border border-zinc-700/60 text-zinc-300 font-mono px-2 py-0.5 rounded text-[10px]">
                              {proj.model}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-semibold text-zinc-400">
                            {proj.tokensUsed.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-semibold text-zinc-400">
                            ${proj.estimatedCost.toFixed(4)}
                          </td>
                          <td className="px-6 py-4 text-zinc-500 font-mono">
                            {new Date(proj.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-full font-bold border ${
                              proj.status === 'Completed'
                                ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                            }`}>
                              {proj.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => deleteProject(proj.id)}
                                title="Delete Project and Artifacts"
                                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-500 border border-zinc-800 rounded transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AI GATEWAY */}
          {activeTab === 'ai-gateway' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
              
              {/* Models List */}
              <div className="lg:col-span-2 space-y-6">
                {Object.keys(providers).map((keyName) => {
                  const prov = (providers as any)[keyName];
                  return (
                    <div key={keyName} className="bg-zinc-900/20 border border-zinc-800/80 p-6 rounded-xl flex flex-col space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Cpu className="h-5 w-5 text-teal-500" />
                          <h4 className="font-semibold capitalize">{keyName} Model Gateway</h4>
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
                            <ToggleRight className="h-8 w-8 text-teal-500" />
                          ) : (
                            <ToggleLeft className="h-8 w-8 text-zinc-600" />
                          )}
                        </button>
                      </div>

                      {/* Config Form Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1.5">
                          <label className="text-zinc-500 font-semibold">Model Selector Identifier</label>
                          <input 
                            type="text" 
                            value={prov.model}
                            onChange={(e) => {
                              setProviders(prev => ({
                                ...prev,
                                [keyName]: { ...(prev as any)[keyName], model: e.target.value }
                              }));
                            }}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 focus:border-zinc-700 outline-none text-zinc-300 font-mono" 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-zinc-500 font-semibold">Gateway Key credentials</label>
                          <div className="relative">
                            <Key className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                            <input 
                              type="password" 
                              value={prov.key}
                              onChange={(e) => {
                                setProviders(prev => ({
                                  ...prev,
                                  [keyName]: { ...(prev as any)[keyName], key: e.target.value }
                                }));
                              }}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded py-2 pl-8 pr-3 focus:border-zinc-700 outline-none text-zinc-300 font-mono" 
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-zinc-500 font-semibold">Max Completion Tokens</label>
                          <input type="number" defaultValue={4096} className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 focus:border-zinc-700 outline-none text-zinc-300 font-mono" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-zinc-500 font-semibold">Temperature (Precision Range)</label>
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
                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 focus:border-zinc-700 outline-none text-zinc-300 font-mono" 
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Fallback settings */}
              <div className="bg-zinc-900/20 border border-zinc-800/80 p-6 rounded-xl flex flex-col space-y-6 h-fit">
                <div>
                  <h4 className="text-sm font-semibold">Ensemble Routing Fallback Chain</h4>
                  <p className="text-xs text-zinc-500 mt-1">Order in which requests failover when rate limits are exhausted</p>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  {fallbackOrder.map((modelId, idx) => (
                    <div key={modelId} className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-lg group">
                      <div className="flex items-center space-x-3">
                        <span className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-zinc-300">{modelId}</span>
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
                          className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded"
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
                          className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <Button 
                  onClick={() => alert('AI Gateway Routing Order updated in database config caches successfully.')} 
                  className="w-full bg-teal-600 hover:bg-teal-500 text-zinc-100 text-xs font-semibold py-2.5"
                >
                  Apply Routing Configuration
                </Button>
              </div>
            </div>
          )}

          {/* TAB 5: SYSTEM MONITORING */}
          {activeTab === 'monitoring' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* Monitoring dials */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Dial 1: CPU */}
                <div className="bg-zinc-900/20 border border-zinc-800/80 p-6 rounded-xl flex flex-col items-center justify-center text-center space-y-4">
                  <span className="text-sm font-semibold">Active CPU utilization</span>
                  
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    {/* SVG circular track */}
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="72" cy="72" r="58" stroke="currentColor" strokeWidth="10" className="text-zinc-800" fill="transparent" />
                      <circle cx="72" cy="72" r="58" stroke="currentColor" strokeWidth="10" 
                        strokeDasharray={2 * Math.PI * 58} 
                        strokeDashoffset={2 * Math.PI * 58 * (1 - liveCpu / 100)} 
                        className="text-teal-500 transition-all duration-1000" fill="transparent" strokeLinecap="round" />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-3xl font-extrabold tracking-tight font-mono">{liveCpu}%</span>
                      <span className="text-[9px] text-zinc-500 font-semibold tracking-wider uppercase">User Core Load</span>
                    </div>
                  </div>
                  
                  <span className="text-[10px] text-zinc-400 font-mono">Dynamic processor scheduling</span>
                </div>

                {/* Dial 2: MEMORY */}
                <div className="bg-zinc-900/20 border border-zinc-800/80 p-6 rounded-xl flex flex-col items-center justify-center text-center space-y-4">
                  <span className="text-sm font-semibold">RAM Usage Index</span>
                  
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="72" cy="72" r="58" stroke="currentColor" strokeWidth="10" className="text-zinc-800" fill="transparent" />
                      <circle cx="72" cy="72" r="58" stroke="currentColor" strokeWidth="10" 
                        strokeDasharray={2 * Math.PI * 58} 
                        strokeDashoffset={2 * Math.PI * 58 * (1 - liveMemory / 100)} 
                        className="text-teal-500 transition-all duration-1000" fill="transparent" strokeLinecap="round" />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-3xl font-extrabold tracking-tight font-mono">{liveMemory}%</span>
                      <span className="text-[9px] text-zinc-500 font-semibold tracking-wider uppercase">System Cache</span>
                    </div>
                  </div>
                  
                  <span className="text-[10px] text-zinc-400 font-mono">Total allocated cache buffers</span>
                </div>

                {/* Dial 3: LATENCY */}
                <div className="bg-zinc-900/20 border border-zinc-800/80 p-6 rounded-xl flex flex-col items-center justify-center text-center space-y-4">
                  <span className="text-sm font-semibold">Database response time</span>
                  
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="72" cy="72" r="58" stroke="currentColor" strokeWidth="10" className="text-zinc-800" fill="transparent" />
                      <circle cx="72" cy="72" r="58" stroke="currentColor" strokeWidth="10" 
                        strokeDasharray={2 * Math.PI * 58} 
                        strokeDashoffset={2 * Math.PI * 58 * (1 - liveLatency / 50)} 
                        className="text-teal-500 transition-all duration-1000" fill="transparent" strokeLinecap="round" />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-3xl font-extrabold tracking-tight font-mono">{liveLatency}ms</span>
                      <span className="text-[9px] text-zinc-500 font-semibold tracking-wider uppercase">PRISMA CONNECT</span>
                    </div>
                  </div>
                  
                  <span className="text-[10px] text-zinc-400 font-mono">Open connection pool latency</span>
                </div>

              </div>

              {/* Server Metadata and Sessions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Active Server Context */}
                <div className="bg-zinc-900/20 border border-zinc-800/80 p-6 rounded-xl space-y-4 lg:col-span-1">
                  <h4 className="text-sm font-semibold">Admin Machine context</h4>
                  
                  <div className="space-y-3 text-xs font-mono">
                    <div className="flex justify-between border-b border-zinc-800 pb-1">
                      <span className="text-zinc-500">Operation System</span>
                      <span className="text-zinc-300">
                        {statsData?.systemHealth?.osType || 'Server OS'} ({statsData?.systemHealth?.osArch || 'x64'})
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-800 pb-1">
                      <span className="text-zinc-500">System Platform</span>
                      <span className="text-zinc-300">{statsData?.systemHealth?.osPlatform || 'linux'}</span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-800 pb-1">
                      <span className="text-zinc-500">Local Uptime</span>
                      <span className="text-zinc-300">
                        {statsData?.systemHealth?.osUptime ? Math.round(statsData.systemHealth.osUptime / 3600) : 0} hours
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-800 pb-1">
                      <span className="text-zinc-500">CPU Count</span>
                      <span className="text-zinc-300">{statsData?.systemHealth?.osCpusCount || 0} vCPUs</span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-800 pb-1">
                      <span className="text-zinc-500">Load Average (5m)</span>
                      <span className="text-zinc-300">0.14</span>
                    </div>
                  </div>
                </div>

                {/* Active Sessions */}
                <div className="bg-zinc-900/20 border border-zinc-800/80 p-6 rounded-xl space-y-4 lg:col-span-2">
                  <h4 className="text-sm font-semibold">Active Session tracking (Token-Store)</h4>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-500">
                          <th className="pb-2 font-semibold">Browser Client</th>
                          <th className="pb-2 font-semibold">Active IP address</th>
                          <th className="pb-2 font-semibold">Logged Since</th>
                          <th className="pb-2 font-semibold text-right">Scope</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                        {[
                          { client: 'Chrome 124.0.0 (Windows)', ip: '127.0.0.1 (Localhost)', activeSince: 'Just now', scope: 'Read/Write' },
                          { client: 'Firefox 125.1.0 (macOS)', ip: '192.168.1.15', activeSince: '45 mins ago', scope: 'Read-Only' },
                          { client: 'Safari iOS 17.4 (iPhone)', ip: '172.56.21.99', activeSince: '2 hours ago', scope: 'Read/Write' },
                        ].map((sess, i) => (
                          <tr key={i} className="hover:bg-zinc-900/10">
                            <td className="py-2.5 font-sans font-semibold text-zinc-200">{sess.client}</td>
                            <td className="py-2.5">{sess.ip}</td>
                            <td className="py-2.5 text-zinc-500">{sess.activeSince}</td>
                            <td className="py-2.5 text-right text-teal-400 font-semibold">{sess.scope}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 6: AUDIT LOGS */}
          {activeTab === 'audit-logs' && statsData && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Compliance Audit Vault</h4>
                  <span className="text-xs text-zinc-500 font-mono">Immutable audit records</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500">
                        <th className="px-6 py-3 font-semibold">Timestamp</th>
                        <th className="px-6 py-3 font-semibold">Actor / User</th>
                        <th className="px-6 py-3 font-semibold">Action Type</th>
                        <th className="px-6 py-3 font-semibold">Resource Details</th>
                        <th className="px-6 py-3 font-semibold">Result</th>
                        <th className="px-6 py-3 font-semibold">Client Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40 font-mono text-zinc-400">
                      {[
                        { time: '21:05:42', user: 'admin@test-analyst.com', action: 'API_KEY_UPDATE', res: 'Updated Groq API gateway credentials', resCode: 'SUCCESS', ip: '127.0.0.1' },
                        { time: '21:01:21', user: 'admin@test-analyst.com', action: 'SYSTEM_SETTINGS_CHANGE', res: 'Modified token timeout threshold to 30 mins', resCode: 'SUCCESS', ip: '127.0.0.1' },
                        { time: '20:50:31', user: 'lead-analyst@acme.com', action: 'PROJECT_ARCHIVE', res: 'Archived project id: 2e8b2f91-58ac', resCode: 'SUCCESS', ip: '192.168.1.42' },
                        { time: '20:44:12', user: 'guest-qa@gmail.com', action: 'LOGIN_FAILURE', res: 'Incorrect password attempt', resCode: 'FAILED', ip: '172.16.89.5' },
                        { time: '20:39:55', user: 'system-daemon', action: 'CRON_DATABASE_BACKUP', res: 'Automatic postgres schema snapshot backing up', resCode: 'SUCCESS', ip: 'localhost' },
                      ].map((item, idx) => (
                        <tr key={idx} className="hover:bg-zinc-900/10">
                          <td className="px-6 py-3 text-zinc-500">{item.time}</td>
                          <td className="px-6 py-3 font-sans font-semibold text-zinc-200">{item.user}</td>
                          <td className="px-6 py-3">
                            <span className="bg-zinc-800 border border-zinc-700/60 text-zinc-300 px-2 py-0.5 rounded">
                              {item.action}
                            </span>
                          </td>
                          <td className="px-6 py-3 truncate max-w-[200px]">{item.res}</td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-0.5 rounded-full font-bold border ${
                              item.resCode === 'SUCCESS' ? 'text-green-500 border-green-500/20 bg-green-500/5' : 'text-red-500 border-red-500/20 bg-red-500/5'
                            }`}>
                              {item.resCode}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-zinc-500">{item.ip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl bg-zinc-900/20 border border-zinc-800/80 p-8 rounded-xl space-y-6 animate-in fade-in duration-300">
              <h3 className="text-sm font-semibold border-b border-zinc-800 pb-3">Administrative System Configuration</h3>
              
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-zinc-500 font-semibold">User Session Timeout (minutes)</label>
                    <input type="number" defaultValue={60} className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 focus:border-zinc-700 outline-none text-zinc-300" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-zinc-500 font-semibold">Default Daily User Token Quota</label>
                    <input type="number" defaultValue={250000} className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 focus:border-zinc-700 outline-none text-zinc-300" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-500 font-semibold">File Upload Limits (MB)</label>
                  <input type="number" defaultValue={10} className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 focus:border-zinc-700 outline-none text-zinc-300" />
                </div>

                <div className="space-y-3 pt-4 border-t border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-zinc-300">Enforce Multi-Factor Authentication (MFA)</span>
                      <span className="text-[10px] text-zinc-500">Require MFA verification for administrative logins</span>
                    </div>
                    <button onClick={() => alert('MFA toggling requires Super Admin credentials.')} className="focus:outline-none">
                      <ToggleLeft className="h-8 w-8 text-zinc-600" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-zinc-300">Maintenance mode</span>
                      <span className="text-[10px] text-zinc-500">Lock database transactions and disable frontend endpoints</span>
                    </div>
                    <button onClick={() => alert('System Maintenance Mode requires a console reset key.')} className="focus:outline-none">
                      <ToggleLeft className="h-8 w-8 text-zinc-600" />
                    </button>
                  </div>
                </div>

                <Button 
                  onClick={() => alert('Global System Configuration saved successfully.')} 
                  className="w-full bg-teal-600 hover:bg-teal-500 text-zinc-100 text-xs font-semibold py-2.5 mt-6"
                >
                  Save Global System Configurations
                </Button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
