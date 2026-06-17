'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Settings, Trash2, Mail, Server, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'motion/react';

interface EmailConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  email: string;
  createdAt: string;
}

export default function EmailConfigsPage() {
  const [configs, setConfigs] = useState<EmailConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [newConfig, setNewConfig] = useState({ name: '', host: '', port: '587', email: '', password: '' });
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { token } = useAuth();

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/admin/email-configs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setConfigs(data);
    } catch (error) {
      toast.error('Failed to fetch configurations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchConfigs();
  }, [token]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/email-configs', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newConfig),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('SMTP Configuration added');
        setIsAddOpen(false);
        setNewConfig({ name: '', host: '', port: '587', email: '', password: '' });
        fetchConfigs();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to add configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) return;
    try {
      const res = await fetch('/api/admin/email-configs', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Configuration deleted');
        fetchConfigs();
      } else {
        toast.error(data.error || 'Failed to delete configuration');
      }
    } catch (error) {
      toast.error('Network error during deletion');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/email-configs', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editingConfig),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('SMTP Configuration updated');
        setIsEditOpen(false);
        fetchConfigs();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to update configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="page-title">
            <h1 className="text-3xl font-bold text-[#1e293b] tracking-tight">SMTP Configurations</h1>
            <p className="text-[#64748b] mt-1">Manage email accounts used for sending approvals and OTPs.</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger
              render={
                <Button className="bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-lg px-5 h-10 font-semibold shadow-sm shadow-indigo-100">
                  <Plus className="w-4 h-4 mr-2" />
                  Add SMTP Config
                </Button>
              }
            />
            <DialogContent className="sm:max-w-[450px] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
              <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
                <DialogTitle className="text-xl font-bold text-[#1e293b]">Add SMTP Server</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="p-8 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">SMTP Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. Sales Team or Admin Name" 
                    value={newConfig.name}
                    onChange={(e) => setNewConfig({...newConfig, name: e.target.value})}
                    className="rounded-xl border-[#e2e8f0] focus:ring-[#6366f1]"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="host" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">SMTP Host</Label>
                  <Input 
                    id="host" 
                    placeholder="smtp.gmail.com" 
                    value={newConfig.host}
                    onChange={(e) => setNewConfig({...newConfig, host: e.target.value})}
                    className="rounded-xl border-[#e2e8f0] focus:ring-[#6366f1]"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Port</Label>
                  <Input 
                    id="port" 
                    type="number"
                    placeholder="587" 
                    value={newConfig.port}
                    onChange={(e) => setNewConfig({...newConfig, port: e.target.value})}
                    className="rounded-xl border-[#e2e8f0] focus:ring-[#6366f1]"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="notifications@company.com" 
                    value={newConfig.email}
                    onChange={(e) => setNewConfig({...newConfig, email: e.target.value})}
                    className="rounded-xl border-[#e2e8f0] focus:ring-[#6366f1]"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">App Password / Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••••••" 
                    value={newConfig.password}
                    onChange={(e) => setNewConfig({...newConfig, password: e.target.value})}
                    className="rounded-xl border-[#e2e8f0] focus:ring-[#6366f1]"
                    required 
                  />
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-xl py-6 font-bold shadow-sm shadow-indigo-100">
                  {isSubmitting ? 'Saving...' : 'Save Configuration'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="sm:max-w-[450px] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
              <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
                <DialogTitle className="text-xl font-bold text-[#1e293b]">Edit SMTP Server</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdate} className="p-8 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-name" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">SMTP Name</Label>
                  <Input 
                    id="edit-name" 
                    value={editingConfig?.name || ''}
                    onChange={(e) => setEditingConfig({...editingConfig, name: e.target.value})}
                    className="rounded-xl border-[#e2e8f0] focus:ring-[#6366f1]"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-host" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">SMTP Host</Label>
                  <Input 
                    id="edit-host" 
                    value={editingConfig?.host || ''}
                    onChange={(e) => setEditingConfig({...editingConfig, host: e.target.value})}
                    className="rounded-xl border-[#e2e8f0] focus:ring-[#6366f1]"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-port" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Port</Label>
                  <Input 
                    id="edit-port" 
                    type="number"
                    value={editingConfig?.port || ''}
                    onChange={(e) => setEditingConfig({...editingConfig, port: e.target.value})}
                    className="rounded-xl border-[#e2e8f0] focus:ring-[#6366f1]"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Email Address</Label>
                  <Input 
                    id="edit-email" 
                    type="email" 
                    value={editingConfig?.email || ''}
                    onChange={(e) => setEditingConfig({...editingConfig, email: e.target.value})}
                    className="rounded-xl border-[#e2e8f0] focus:ring-[#6366f1]"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-password" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">New Password (leave empty to keep same)</Label>
                  <Input 
                    id="edit-password" 
                    type="password" 
                    placeholder="••••••••••••" 
                    onChange={(e) => setEditingConfig({...editingConfig, password: e.target.value})}
                    className="rounded-xl border-[#e2e8f0] focus:ring-[#6366f1]"
                  />
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-xl py-6 font-bold shadow-sm shadow-indigo-100">
                  {isSubmitting ? 'Updating...' : 'Update Configuration'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
          {loading ? (
            <p className="text-[#64748b]">Loading configurations...</p>
          ) : configs.length === 0 ? (
            <p className="text-[#64748b]">No SMTP configurations found.</p>
          ) : (
            configs.map((config, index) => (
              <motion.div
                key={config.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden group hover:shadow-md transition-all">
                  <CardHeader className="px-4 md:px-8 py-4 md:py-6 bg-[#fafafa] border-b border-[#e2e8f0]">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-[#eef2ff] text-[#6366f1] flex items-center justify-center shadow-sm">
                        <Server className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-[#64748b] hover:text-[#6366f1] hover:bg-blue-50 rounded-lg md:opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 md:w-10 md:h-10"
                          onClick={() => {
                            setEditingConfig({ ...config, password: '' });
                            setIsEditOpen(true);
                          }}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-[#64748b] hover:text-rose-600 hover:bg-rose-50 rounded-lg md:opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 md:w-10 md:h-10"
                          onClick={() => handleDelete(config.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="text-sm md:text-lg font-bold text-[#1e293b] mt-3 md:mt-5 truncate">{config.name}</CardTitle>
                    <div className="text-xs font-semibold text-[#64748b] truncate mt-1">{config.email}</div>
                  </CardHeader>
                  <CardContent className="p-4 md:p-8 space-y-3 md:space-y-5">
                    <div className="flex items-center text-xs md:text-sm text-[#64748b]">
                      <Mail className="w-3 h-3 md:w-4 md:h-4 mr-2 md:mr-3 text-[#cbd5e1] hidden sm:block" />
                      <span className="truncate font-medium">{config.host}</span>
                    </div>
                    <div className="flex items-center text-[9px] md:text-[10px] font-bold text-[#22c55e] bg-[#f0fdf4] px-2 md:px-3 py-1 md:py-1.5 rounded-full w-fit uppercase tracking-wider">
                      <ShieldCheck className="w-3 h-3 mr-1 md:mr-1.5" />
                      Active
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

