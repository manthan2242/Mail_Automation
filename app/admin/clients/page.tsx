'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { 
  Briefcase, 
  Target, 
  Plus, 
  Trash2, 
  Edit3, 
  Mail, 
  Clock, 
  Search, 
  CheckCircle2, 
  TrendingUp, 
  UserPlus, 
  FolderPlus, 
  AlertCircle,
  BarChart3
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  shortName: string | null;
  clientId: string;
}

interface TargetType {
  id: string;
  clientId: string;
  projectId: string;
  mailCount: number;
  frequency: string;
  currentCount: number;
  isCompleted: boolean;
  lastReset: string;
  client: Client;
  project: Project;
}

interface Client {
  id: string;
  name: string;
  primaryMail: string;
  secondaryMail: string | null;
  optionalMail: string | null;
  projects: Project[];
  targets: TargetType[];
}

export default function ClientsPage() {
  const { token } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [targets, setTargets] = useState<TargetType[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [clientSearch, setClientSearch] = useState('');

  // Modals state
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [targetModalOpen, setTargetModalOpen] = useState(false);

  // Editing state
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form states
  const [clientForm, setClientForm] = useState({
    name: '',
    primaryMail: '',
    secondaryMail: '',
    optionalMail: ''
  });

  const [projectForm, setProjectForm] = useState({
    name: '',
    shortName: '',
    shortName2: '',
    clientId: ''
  });

  const [targetForm, setTargetForm] = useState({
    clientId: '',
    projectId: '',
    mailCount: '',
    frequency: 'WEEKLY'
  });

  const fetchData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [clientsRes, targetsRes] = await Promise.all([
        fetch('/api/admin/clients', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/targets', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (clientsRes.ok && targetsRes.ok) {
        const clientsData = await clientsRes.json();
        const targetsData = await targetsRes.json();
        setClients(clientsData);
        setTargets(targetsData);
      } else {
        toast.error('Failed to load dashboard data');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error fetching details from the database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Client Handlers
  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name || !clientForm.primaryMail || !clientForm.secondaryMail) {
      toast.error('Please enter name, primary email, and secondary email');
      return;
    }

    const pEmail = clientForm.primaryMail.trim().toLowerCase();
    const sEmail = clientForm.secondaryMail.trim().toLowerCase();
    const oEmail = clientForm.optionalMail.trim().toLowerCase();

    if (pEmail === sEmail) {
      toast.error('Primary and Secondary email addresses must be different');
      return;
    }
    if (oEmail && (oEmail === pEmail || oEmail === sEmail)) {
      toast.error('Optional Email must be different from Primary and Secondary emails');
      return;
    }

    try {
      const url = editingClient ? `/api/admin/clients/${editingClient.id}` : '/api/admin/clients';
      const method = editingClient ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(clientForm)
      });

      if (res.ok) {
        toast.success(editingClient ? 'Client updated successfully' : 'Client created successfully');
        setClientForm({ name: '', primaryMail: '', secondaryMail: '', optionalMail: '' });
        setEditingClient(null);
        setClientModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to submit client form');
      }
    } catch (err) {
      toast.error('Error submitting form');
    }
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setClientForm({
      name: client.name,
      primaryMail: client.primaryMail,
      secondaryMail: client.secondaryMail || '',
      optionalMail: client.optionalMail || ''
    });
    setClientModalOpen(true);
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client? This will delete all associated projects and targets.')) return;
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Client deleted successfully');
        fetchData();
      } else {
        toast.error('Failed to delete client');
      }
    } catch (err) {
      toast.error('Error deleting client');
    }
  };

  // Project Handlers
  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.name || !projectForm.clientId) {
      toast.error('Project Name and Client are required');
      return;
    }

    try {
      const res = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(projectForm)
      });

      if (res.ok) {
        toast.success('Project added successfully');
        setProjectForm({ name: '', shortName: '', shortName2: '', clientId: '' });
        setProjectModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create project');
      }
    } catch (err) {
      toast.error('Error creating project');
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project? This will also remove any target configurations.')) return;
    try {
      const res = await fetch(`/api/admin/projects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Project deleted successfully');
        fetchData();
      } else {
        toast.error('Failed to delete project');
      }
    } catch (err) {
      toast.error('Error deleting project');
    }
  };

  // Target Handlers
  const handleTargetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetForm.clientId || !targetForm.projectId || !targetForm.mailCount) {
      toast.error('Please fill in all target fields');
      return;
    }

    try {
      const res = await fetch('/api/admin/targets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(targetForm)
      });

      if (res.ok) {
        toast.success('Target set successfully');
        setTargetForm({ clientId: '', projectId: '', mailCount: '', frequency: 'WEEKLY' });
        setTargetModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create target');
      }
    } catch (err) {
      toast.error('Error setting target');
    }
  };

  const handleDeleteTarget = async (id: string) => {
    if (!confirm('Are you sure you want to delete this target configuration?')) return;
    try {
      const res = await fetch(`/api/admin/targets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Target deleted successfully');
        fetchData();
      } else {
        toast.error('Failed to delete target');
      }
    } catch (err) {
      toast.error('Error deleting target');
    }
  };

  // Computed Values for dashboard summary metrics
  const selectedProjectName = clients
    .find(c => c.id === targetForm.clientId)
    ?.projects.find(p => p.id === targetForm.projectId)?.name;

  const activeClientsCount = clients.length;
  const activeTargetsCount = targets.length;
  const completedTargetsCount = targets.filter(t => t.isCompleted).length;
  const totalProgress = targets.reduce((sum, t) => sum + (t.mailCount > 0 ? Math.min(t.currentCount / t.mailCount, 1) : 0), 0);
  const targetSuccessRate = activeTargetsCount > 0 
    ? Math.round((totalProgress / activeTargetsCount) * 100) 
    : 0;

  // Filtering clients
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.primaryMail.toLowerCase().includes(clientSearch.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-10">
        
        {/* Page Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#1e293b] tracking-tight flex items-center gap-2">
              <Briefcase className="w-8 h-8 text-indigo-500" />
              Clients & Targets
            </h1>
            <p className="text-[#64748b] mt-1">Configure client directories, projects, and email SLA volume targets.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/admin/emails?filter=clients-only">
              <Button variant="outline" className="bg-white border-[#e2e8f0] text-[#1e293b] rounded-xl shadow-sm h-10 px-4 font-semibold text-sm hover:bg-slate-50">
                <Mail className="w-4 h-4 mr-2 text-indigo-500" />
                Client Mail History
              </Button>
            </Link>
            
            {/* Add Client Dialog Trigger */}
            <Dialog open={clientModalOpen} onOpenChange={(open) => {
              setClientModalOpen(open);
              if (!open) {
                setEditingClient(null);
                setClientForm({ name: '', primaryMail: '', secondaryMail: '', optionalMail: '' });
              }
            }}>
              <DialogTrigger render={<Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm h-10 px-4 font-semibold text-sm" />}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Client
              </DialogTrigger>
              <DialogContent className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-[#1e293b]">
                    {editingClient ? 'Edit Client Profile' : 'Register New Client'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleClientSubmit} className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#475569]">Client Name</label>
                    <Input 
                      placeholder="e.g. Acme Corporation" 
                      value={clientForm.name} 
                      onChange={e => setClientForm({...clientForm, name: e.target.value})}
                      className="border-slate-200 focus:border-indigo-500 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#475569]">Primary Email</label>
                    <Input 
                      type="email" 
                      placeholder="e.g. main@acme.com" 
                      value={clientForm.primaryMail} 
                      onChange={e => setClientForm({...clientForm, primaryMail: e.target.value})}
                      className="border-slate-200 focus:border-indigo-500 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#475569]">Secondary Email</label>
                    <Input 
                      type="email" 
                      placeholder="e.g. secondary@acme.com" 
                      value={clientForm.secondaryMail} 
                      onChange={e => setClientForm({...clientForm, secondaryMail: e.target.value})}
                      className="border-slate-200 focus:border-indigo-500 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#475569]">Optional Email 3 (Optional)</label>
                    <Input 
                      type="email" 
                      placeholder="e.g. alternate@acme.com" 
                      value={clientForm.optionalMail} 
                      onChange={e => setClientForm({...clientForm, optionalMail: e.target.value})}
                      className="border-slate-200 focus:border-indigo-500 rounded-xl"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={() => setClientModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                      {editingClient ? 'Save Changes' : 'Create Client'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Add Project Dialog Trigger */}
            <Dialog open={projectModalOpen} onOpenChange={setProjectModalOpen}>
              <DialogTrigger render={<Button variant="outline" className="bg-white border-[#e2e8f0] text-[#1e293b] rounded-xl shadow-sm h-10 px-4 font-semibold text-sm hover:bg-slate-50" />}>
                <FolderPlus className="w-4 h-4 mr-2" />
                Add Project
              </DialogTrigger>
              <DialogContent className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-[#1e293b]">Add Client Project</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleProjectSubmit} className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#475569]">Select Client</label>
                    <Select value={projectForm.clientId} onValueChange={val => setProjectForm({...projectForm, clientId: val || ''})}>
                      <SelectTrigger className="border-slate-200 rounded-xl">
                        <SelectValue placeholder="Choose a client...">
                          {clients.find(c => c.id === projectForm.clientId)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 shadow-lg z-[210]">
                        {clients.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#475569]">Project Name</label>
                    <Input 
                      placeholder="e.g. Website Overhaul" 
                      value={projectForm.name} 
                      onChange={e => setProjectForm({...projectForm, name: e.target.value})}
                      className="border-slate-200 focus:border-indigo-500 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#475569]">Project Keyword / Short Name (For Subject Match)</label>
                    <Input 
                      placeholder="e.g. Overhaul" 
                      value={projectForm.shortName} 
                      onChange={e => setProjectForm({...projectForm, shortName: e.target.value})}
                      className="border-slate-200 focus:border-indigo-500 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#475569]">Secondary Keyword / Short Name (Optional)</label>
                    <Input 
                      placeholder="e.g. Alternate Keyword" 
                      value={projectForm.shortName2} 
                      onChange={e => setProjectForm({...projectForm, shortName2: e.target.value})}
                      className="border-slate-200 focus:border-indigo-500 rounded-xl"
                    />
                    <p className="text-[10px] text-slate-400">Emails with subjects containing either of these keywords or the full project name will be matched.</p>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={() => setProjectModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                      Add Project
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Set Target Dialog Trigger */}
            <Dialog open={targetModalOpen} onOpenChange={setTargetModalOpen}>
              <DialogTrigger render={<Button className="bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-xl shadow-sm h-10 px-4 font-semibold text-sm" />}>
                <Target className="w-4 h-4 mr-2" />
                Configure SLA Target
              </DialogTrigger>
              <DialogContent className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-[#1e293b]">Setup Target Metrics</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleTargetSubmit} className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#475569]">Select Client</label>
                    <Select value={targetForm.clientId} onValueChange={val => {
                      setTargetForm({...targetForm, clientId: val || '', projectId: ''});
                    }}>
                      <SelectTrigger className="border-slate-200 rounded-xl">
                        <SelectValue placeholder="Choose a client...">
                          {clients.find(c => c.id === targetForm.clientId)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 shadow-lg z-[210]">
                        {clients.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#475569]">Select Project</label>
                    <Select 
                      value={targetForm.projectId} 
                      onValueChange={val => setTargetForm({...targetForm, projectId: val || ''})}
                      disabled={!targetForm.clientId}
                    >
                      <SelectTrigger className="border-slate-200 rounded-xl">
                        <SelectValue placeholder="Choose a project...">
                          {selectedProjectName}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 shadow-lg z-[210]">
                        {clients.find(c => c.id === targetForm.clientId)?.projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        )) || <SelectItem value="none" disabled>Select a client first</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#475569]">Target Mail Volume Count</label>
                    <Input 
                      type="number"
                      min="1"
                      placeholder="e.g. 5" 
                      value={targetForm.mailCount} 
                      onChange={e => setTargetForm({...targetForm, mailCount: e.target.value})}
                      className="border-slate-200 focus:border-indigo-500 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#475569]">Tracking Frequency Period</label>
                    <Select value={targetForm.frequency} onValueChange={val => setTargetForm({...targetForm, frequency: val || 'WEEKLY'})}>
                      <SelectTrigger className="border-slate-200 rounded-xl">
                        <SelectValue placeholder="Select period frequency" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 shadow-lg z-[210]">
                        <SelectItem value="DAILY">Daily Volume Target</SelectItem>
                        <SelectItem value="WEEKLY">Weekly Volume Target</SelectItem>
                        <SelectItem value="MONTHLY">Monthly Volume Target</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={() => setTargetModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                      Save Target SLA
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

          </div>
        </header>

        {/* Dynamic Metric Banners */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] bg-white rounded-[24px] overflow-hidden">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-[0.05em] mb-1">Registered Clients</p>
                  <p className="text-3xl font-light text-[#1e293b] tracking-tight">{loading ? '...' : activeClientsCount}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                  <Briefcase className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] bg-white rounded-[24px] overflow-hidden">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-[0.05em] mb-1">Active SLA Targets</p>
                  <p className="text-3xl font-light text-[#1e293b] tracking-tight">{loading ? '...' : activeTargetsCount}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500">
                  <Target className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] bg-white rounded-[24px] overflow-hidden">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-[0.05em] mb-1">SLA Target Success Rate</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-light text-[#1e293b] tracking-tight">{loading ? '...' : `${targetSuccessRate}%`}</p>
                    <span className="text-[10px] text-emerald-500 font-bold uppercase flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" />
                      On Track
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                  <BarChart3 className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </div>

        {/* Dashboard Tabs Layout */}
        <Tabs defaultValue="targets" className="w-full space-y-6">
          <TabsList className="bg-slate-100/80 p-1 rounded-xl flex w-fit gap-1 shrink-0">
            <TabsTrigger value="targets" className="rounded-lg px-6 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all">
              SLA Targets
            </TabsTrigger>
            <TabsTrigger value="clients" className="rounded-lg px-6 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all">
              Clients Directory
            </TabsTrigger>
            <TabsTrigger value="projects" className="rounded-lg px-6 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all">
              Projects List
            </TabsTrigger>
          </TabsList>

          {/* targets tab contents */}
          <TabsContent value="targets" className="outline-none">
            {loading ? (
              <div className="text-center py-20 text-slate-400">Loading tracking engine metadata...</div>
            ) : targets.length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-[24px] p-12 text-center flex flex-col items-center">
                <AlertCircle className="w-10 h-10 text-slate-300 mb-3" />
                <h3 className="font-bold text-slate-800 text-base">No Communication Targets Set</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">Setup daily, weekly, or monthly communication volume requirements to start auto-tracking SLA goals.</p>
                <Button onClick={() => setTargetModalOpen(true)} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs h-9">
                  Configure SLA Target
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {targets.map((target) => {
                  const percent = Math.min(Math.round((target.currentCount / target.mailCount) * 100), 100);
                  const isDone = target.isCompleted;

                  // Dynamic color parameters based on frequency
                  const frequencyColors: Record<string, string> = {
                    DAILY: 'bg-violet-50 text-violet-600 border-violet-100',
                    WEEKLY: 'bg-indigo-50 text-indigo-600 border-indigo-100',
                    MONTHLY: 'bg-amber-50 text-amber-600 border-amber-100'
                  };

                  return (
                    <motion.div key={target.id} layout>
                      <Card className="border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] bg-white rounded-[24px] overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                        <CardHeader className="p-6 pb-4 border-b border-slate-50 flex flex-row items-start justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-400">Target SLA Configuration</p>
                            <h3 className="font-bold text-slate-800 mt-1 text-base">{target.client.name}</h3>
                            <p className="text-xs text-indigo-500 font-semibold mt-0.5">{target.project.name}</p>
                          </div>
                          <Badge variant="outline" className={`${frequencyColors[target.frequency] || 'bg-slate-50 text-slate-600'} rounded-lg px-2.5 py-0.5 text-[10px] font-bold tracking-wider`}>
                            {target.frequency}
                          </Badge>
                        </CardHeader>
                        <CardContent className="p-6 space-y-5">
                          
                          {/* visual progress indicator */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-baseline">
                              <span className="text-xs text-slate-500 font-medium">Communication Volume</span>
                              <span className="text-sm font-bold text-slate-800">{target.currentCount} <span className="text-xs text-slate-400 font-medium">/ {target.mailCount} Mails</span></span>
                            </div>
                            
                            {/* premium custom animated progress bar */}
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }} 
                                animate={{ width: `${percent}%` }} 
                                className={`h-full rounded-full transition-colors duration-500 ${
                                  isDone 
                                    ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                                    : 'bg-indigo-600'
                                }`} 
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            {isDone ? (
                              <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 shadow-none border border-emerald-100 rounded-xl flex items-center gap-1 py-1 font-bold text-[10px]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                SLA SATISFIED
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-slate-50 text-slate-500 hover:bg-slate-50 border-slate-100 rounded-xl flex items-center gap-1 py-1 font-bold text-[10px]">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                IN PROGRESS
                              </Badge>
                            )}

                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDeleteTarget(target.id)}
                              className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg h-8 px-2 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* clients tab contents */}
          <TabsContent value="clients" className="outline-none">
            <Card className="border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] bg-white rounded-[24px] overflow-hidden">
              <CardHeader className="p-6 md:p-8 pb-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-base font-bold text-slate-800">Directory Database</CardTitle>
                <div className="relative max-w-xs w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Search clients or emails..." 
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    className="pl-10 border-slate-200 focus:border-indigo-500 rounded-xl text-xs h-9 bg-slate-50/50"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="text-center py-12 text-slate-400">Loading directory database...</div>
                ) : filteredClients.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">No matching clients found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                          <TableHead className="px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Client Name</TableHead>
                          <TableHead className="px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Primary Email</TableHead>
                          <TableHead className="px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Alt Emails</TableHead>
                          <TableHead className="px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Active Projects</TableHead>
                          <TableHead className="px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredClients.map((client) => (
                          <TableRow key={client.id} className="hover:bg-slate-50/40 border-b border-slate-100 transition-colors">
                            <TableCell className="px-8 py-4 font-semibold text-[#1e293b]">{client.name}</TableCell>
                            <TableCell className="px-8 py-4">
                              <span className="text-slate-600 flex items-center gap-1.5 text-xs font-medium">
                                <Mail className="w-3.5 h-3.5 text-slate-400" />
                                {client.primaryMail}
                              </span>
                            </TableCell>
                            <TableCell className="px-8 py-4">
                              <div className="flex flex-col gap-1">
                                {client.secondaryMail && (
                                  <span className="text-[10px] text-slate-500 bg-slate-50 w-fit px-2 py-0.5 rounded border border-slate-100">{client.secondaryMail}</span>
                                )}
                                {client.optionalMail && (
                                  <span className="text-[10px] text-slate-500 bg-slate-50 w-fit px-2 py-0.5 rounded border border-slate-100">{client.optionalMail}</span>
                                )}
                                {!client.secondaryMail && !client.optionalMail && (
                                  <span className="text-[10px] text-slate-400 italic">None configured</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="px-8 py-4 text-center">
                              <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 rounded-md font-bold px-2 py-0.5 text-[10px]">
                                {client.projects.length} Active
                              </Badge>
                            </TableCell>
                            <TableCell className="px-8 py-4 text-right">
                              <div className="flex justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleEditClient(client)}
                                  title="Edit Client"
                                  className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg h-8 px-2 transition-colors"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleDeleteClient(client.id)}
                                  title="Delete Client"
                                  className="text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg h-8 px-2 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* projects tab contents */}
          <TabsContent value="projects" className="outline-none">
            <Card className="border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] bg-white rounded-[24px] overflow-hidden">
              <CardHeader className="p-6 md:p-8 pb-4 border-b border-slate-50">
                <CardTitle className="text-base font-bold text-slate-800">Projects Directory</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="text-center py-12 text-slate-400">Loading project schemas...</div>
                ) : clients.flatMap(c => c.projects).length === 0 ? (
                  <div className="text-center py-16 text-slate-400 flex flex-col items-center">
                    <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                    <span className="text-xs font-semibold text-slate-500">No projects mapped yet.</span>
                    <Button onClick={() => setProjectModalOpen(true)} className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs h-8">
                      Add Client Project
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                          <TableHead className="px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Project Name</TableHead>
                          <TableHead className="px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Associated Client</TableHead>
                          <TableHead className="px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Short Code / Keyword</TableHead>
                          <TableHead className="px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clients.map(client => 
                          client.projects.map((project) => (
                            <TableRow key={project.id} className="hover:bg-slate-50/40 border-b border-slate-100 transition-colors">
                              <TableCell className="px-8 py-4 font-semibold text-[#1e293b]">{project.name}</TableCell>
                              <TableCell className="px-8 py-4">
                                <span className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 rounded-md px-2 py-0.5">
                                  {client.name}
                                </span>
                              </TableCell>
                              <TableCell className="px-8 py-4 font-mono text-xs text-indigo-600 font-semibold">
                                {project.shortName || (project as any).shortName2 ? (
                                  <div className="flex flex-col gap-1">
                                    {project.shortName && <span>"{project.shortName}"</span>}
                                    {(project as any).shortName2 && <span className="text-indigo-400">"{(project as any).shortName2}"</span>}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-normal italic">Same as name</span>
                                )}
                              </TableCell>
                              <TableCell className="px-8 py-4 text-right">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleDeleteProject(project.id)}
                                  className="text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg h-8 px-2 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
}
