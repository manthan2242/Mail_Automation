'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'motion/react';

interface APIKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
}

export default function APIKeysPage() {
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { token } = useAuth();

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/admin/api-keys', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setKeys(data);
    } catch (error) {
      toast.error('Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchKeys();
  }, [token]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newName }),
      });
      if (res.ok) {
        toast.success('API Key generated');
        setIsAddOpen(false);
        setNewName('');
        fetchKeys();
      }
    } catch (error) {
      toast.error('Failed to generate API key');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;
    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast.success('API Key revoked');
        fetchKeys();
      }
    } catch (error) {
      toast.error('Failed to revoke API key');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">API Keys</h1>
            <p className="text-slate-500 mt-1">Generate secure keys for external integrations.</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger
              render={
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100 rounded-xl">
                  <Plus className="w-4 h-4 mr-2" />
                  Generate New Key
                </Button>
              }
            />
            <DialogContent className="sm:max-w-[425px] bg-white rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-slate-900">Generate API Key</DialogTitle>
                <CardDescription>Give your key a descriptive name to identify its purpose.</CardDescription>
              </DialogHeader>
              <form onSubmit={handleGenerate} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Key Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. Production Mobile App" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required 
                  />
                </div>
                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-6">
                  Generate Key
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <p className="text-slate-500">Loading API keys...</p>
          ) : keys.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Key className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">No API keys generated yet.</p>
              </CardContent>
            </Card>
          ) : (
            keys.map((key, index) => (
              <motion.div
                key={key.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="border-none shadow-sm bg-white overflow-hidden group">
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Key className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{key.name}</h3>
                        <p className="text-xs text-slate-400">Created on {new Date(key.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    <div className="flex-1 max-w-md">
                      <div className="flex items-center bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                        <code className="flex-1 text-sm font-mono text-slate-600 truncate">
                          {visibleKeys[key.id] ? key.key : '••••••••••••••••••••••••••••••••'}
                        </code>
                        <div className="flex items-center ml-2 space-x-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-slate-600"
                            onClick={() => toggleVisibility(key.id)}
                          >
                            {visibleKeys[key.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                            onClick={() => copyToClipboard(key.key, key.id)}
                          >
                            {copiedId === key.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      onClick={() => handleDelete(key.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
