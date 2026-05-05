'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmailAutocomplete } from '@/components/ui/EmailAutocomplete';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Search, 
  Mail, 
  Send, 
  Save, 
  Sparkles, 
  History, 
  ChevronRight, 
  Clock, 
  Search as SearchIcon,
  RefreshCw,
  FileText
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface MailHistoryItem {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
}

interface EmailConfig {
  id: string;
  email: string;
}

export default function AdminMailTool() {
  const [history, setHistory] = useState<MailHistoryItem[]>([]);
  const [configs, setConfigs] = useState<EmailConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('default');
  const [loading, setLoading] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMail, setSelectedMail] = useState<MailHistoryItem | null>(null);
  
  const [mailData, setMailData] = useState({
    to: '',
    subject: '',
    body: ''
  });

  const { token } = useAuth();

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/admin/mail/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/admin/email-configs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setConfigs(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to load SMTP configs');
    }
  };

  useEffect(() => {
    if (token) {
      fetchHistory();
      fetchConfigs();
    }
  }, [token]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery) {
      fetchHistory();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/mail/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setHistory(data);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAIByGenerate = async () => {
    if (!mailData.subject) {
      toast.error('Please enter a topic or subject for AI generator');
      return;
    }
    setGenLoading(true);
    try {
      const res = await fetch('/api/admin/mail/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ subject: mailData.subject })
      });
      const data = await res.json();
      if (res.ok) {
        setMailData(prev => ({ ...prev, body: data.body }));
        toast.success('AI Draft Generated!');
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('AI Generation failed');
    } finally {
      setGenLoading(false);
    }
  };

  const handleProcessMail = async (status: 'SENT' | 'DRAFT') => {
    if (!mailData.to || !mailData.subject || !mailData.body) {
      toast.error('Please fill in all fields');
      return;
    }

    if (status === 'SENT') setSendLoading(true);
    else setSaveLoading(true);

    try {
      const res = await fetch('/api/admin/mail/send', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          ...mailData, 
          status,
          configId: selectedConfigId === 'default' ? undefined : selectedConfigId 
        })
      });
      
      if (res.ok) {
        toast.success(status === 'SENT' ? 'Email sent successfully!' : 'Draft saved!');
        setMailData({ to: '', subject: '', body: '' });
        fetchHistory();
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Operation failed');
    } finally {
      setSendLoading(false);
      setSaveLoading(false);
    }
  };

  const reuseTemplate = (item: MailHistoryItem) => {
    setMailData({
      to: item.to,
      subject: item.subject,
      body: item.body
    });
    toast.info('Template loaded in composer');
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="page-title">
            <h1 className="text-3xl font-bold text-[#1e293b] tracking-tight">Mail Writing Tool</h1>
            <p className="text-[#64748b] mt-1">Compose professional emails manually or with AI assistance.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Mail Composer - 7/12 */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="border border-[#e2e8f0] shadow-[0_2px_12px_rgba(0,0,0,0.02)] bg-white rounded-[24px] overflow-hidden">
              <CardHeader className="bg-[#f8fafc] border-b border-[#e2e8f0]/60 px-8 py-6">
                <CardTitle className="text-xl font-extrabold text-[#1e293b] flex items-center gap-2">
                  <Mail className="w-5 h-5 text-indigo-501" />
                  Email Composer
                </CardTitle>
                <CardDescription>Draft your email below. Use AI for professional assistance.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">Send From</Label>
                    <Select value={selectedConfigId} onValueChange={(val) => setSelectedConfigId(val || 'default')}>
                      <SelectTrigger className="rounded-xl border-[#e2e8f0] h-12 focus:ring-indigo-500/20">
                        <SelectValue placeholder="Select Sender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">System Default (via .env)</SelectItem>
                        {configs.map(config => (
                          <SelectItem key={config.id} value={config.id}>{config.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="to" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">Recipient Address</Label>
                    <EmailAutocomplete 
                      id="to"
                      placeholder="recipient@example.com"
                      value={mailData.to}
                      onChange={(e) => setMailData({...mailData, to: e.target.value})}
                      className="rounded-xl border-[#e2e8f0] h-12 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">Subject / Topic</Label>
                  <div className="flex gap-3">
                    <Input 
                      id="subject"
                      placeholder="e.g., Leave Approval Request"
                      value={mailData.subject}
                      onChange={(e) => setMailData({...mailData, subject: e.target.value})}
                      className="rounded-xl border-[#e2e8f0] h-12 focus:ring-indigo-500/20 flex-1"
                    />
                    <Button 
                      onClick={handleAIByGenerate}
                      disabled={genLoading}
                      variant="outline"
                      className="rounded-xl px-4 h-12 border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold gap-2 whitespace-nowrap"
                    >
                      {genLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      AI Draft
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">Message Content</Label>
                  <Textarea 
                    id="body"
                    placeholder="Write your email here..."
                    className="min-h-[300px] rounded-xl border-[#e2e8f0] p-5 leading-relaxed focus:ring-indigo-500/20"
                    value={mailData.body}
                    onChange={(e) => setMailData({...mailData, body: e.target.value})}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                   <Button 
                    variant="ghost"
                    size="sm"
                    className="text-[#64748b] hover:text-[#1e293b]"
                    onClick={() => setMailData({ to: '', subject: '', body: '' })}
                  >
                    Clear All
                  </Button>
                  
                  <div className="flex gap-3">
                    <Button 
                      variant="outline"
                      className="rounded-xl h-12 px-6 border-[#e2e8f0] hover:bg-slate-50 font-bold gap-2"
                      disabled={saveLoading || sendLoading}
                      onClick={() => handleProcessMail('DRAFT')}
                    >
                      {saveLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Draft
                    </Button>
                    <Button 
                      className="rounded-xl h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 font-bold gap-2"
                      disabled={sendLoading || saveLoading}
                      onClick={() => handleProcessMail('SENT')}
                    >
                      {sendLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send Mail
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mail History & Search - 5/12 */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border border-[#e2e8f0] shadow-[0_2px_12px_rgba(0,0,0,0.02)] bg-white rounded-[24px] h-full flex flex-col overflow-hidden">
               <CardHeader className="bg-white border-b border-[#e2e8f0]/60 px-8 py-6">
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-lg font-extrabold text-[#1e293b] flex items-center gap-2">
                    <History className="w-5 h-5 text-slate-400" />
                    Mail History
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => fetchHistory()} className="h-8 w-8 rounded-full">
                    <RefreshCw className="w-4 h-4 text-slate-400" />
                  </Button>
                </div>
                
                <form onSubmit={handleSearch} className="relative mt-4">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Search by recipient, subject..." 
                    className="pl-10 h-10 rounded-xl bg-slate-50 border-none text-sm placeholder:text-slate-400"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button type="submit" className="hidden">Search</button>
                </form>
              </CardHeader>
              
              <CardContent className="p-0 flex-1 overflow-auto max-h-[700px]">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                    <RefreshCw className="w-8 h-8 animate-spin opacity-20" />
                    <p className="text-sm font-medium">Loading history...</p>
                  </div>
                ) : history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                      <SearchIcon className="w-6 h-6 opacity-30" />
                    </div>
                    <p className="text-sm font-medium">No results found.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    <AnimatePresence mode="popLayout">
                      {history.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="group p-6 hover:bg-slate-50/50 cursor-pointer transition-colors relative"
                          onClick={() => setSelectedMail(item)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className={cn(
                              "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter",
                              item.status === 'SENT' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                            )}>
                              {item.status}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {format(new Date(item.createdAt), 'MMM dd, HH:mm')}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-[#1e293b] group-hover:text-indigo-600 transition-colors line-clamp-1 truncate pr-6">
                            {item.subject}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                            <span className="font-bold text-slate-400 truncate max-w-[150px]">To:</span> {item.to}
                          </p>
                          <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-200 group-hover:text-slate-400 transition-all group-hover:translate-x-1" />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* View Details Modal */}
      <Dialog open={!!selectedMail} onOpenChange={(open) => !open && setSelectedMail(null)}>
        <DialogContent className="sm:max-w-[650px] bg-white rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="px-8 py-6 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-3 mb-2">
               <span className={cn(
                  "text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter",
                  selectedMail?.status === 'SENT' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                )}>
                  {selectedMail?.status}
                </span>
                <span className="text-xs text-slate-400">
                  {selectedMail && format(new Date(selectedMail.createdAt), 'eeee, MMMM dd, yyyy @ HH:mm')}
                </span>
            </div>
            <DialogTitle className="text-2xl font-black text-[#1e293b] leading-tight pr-8">
              {selectedMail?.subject}
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-8 space-y-6 max-h-[70vh] overflow-auto">
            <div className="flex items-center gap-2 p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
              <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-indigo-600 text-xs font-bold">
                {selectedMail?.to[0].toUpperCase()}
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recipient</p>
                <p className="text-sm font-bold text-slate-700">{selectedMail?.to}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-6 whitespace-pre-wrap text-[#334155] text-sm leading-relaxed shadow-sm">
                {selectedMail?.body}
            </div>
            
            <div className="pt-2 flex gap-3">
              <Button 
                onClick={() => selectedMail && reuseTemplate(selectedMail)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 font-bold gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reuse Template
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setSelectedMail(null)}
                className="flex-1 rounded-xl h-12 border-slate-200 hover:bg-slate-50 font-bold"
              >
                Close View
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
