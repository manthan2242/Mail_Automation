'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, CheckCircle, XCircle, Clock, Eye, Sparkles, Send, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface Email {
  id: string;
  subject: string;
  body: string;
  to: string;
  cc?: string;
  bcc?: string;
  fromEmail?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT';
  employee?: { name: string; email: string };
  adminComment?: string;
  configId?: string;
  createdAt: string;
}

interface Config {
  id: string;
  email: string;
}

export default function EmailMonitoringPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [adminComment, setAdminComment] = useState('');
  const [selectedFromEmail, setSelectedFromEmail] = useState('default');
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isEditDraftOpen, setIsEditDraftOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [composeData, setComposeData] = useState({ subject: '', body: '', to: '' });
  const [editDraftData, setEditDraftData] = useState({ subject: '', body: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { token } = useAuth();
  const router = useRouter();

  const fetchData = async () => {
    try {
      const [emailsRes, configsRes] = await Promise.all([
        fetch('/api/admin/emails', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/email-configs', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const emailsData = await emailsRes.json();
      const configsData = await configsRes.json();
      
      setEmails(Array.isArray(emailsData) ? emailsData : []);
      setConfigs(Array.isArray(configsData) ? configsData : []);

    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const handleAction = async (status: 'APPROVED' | 'REJECTED') => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/emails', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          id: selectedEmail?.id, 
          status, 
          adminComment
        }),
      });
      if (res.ok) {
        toast.success(`Email ${status.toLowerCase()} successfully`);
        setIsActionOpen(false);
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to update email status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/emails', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          id: selectedEmail?.id, 
          subject: editDraftData.subject,
          body: editDraftData.body
        }),
      });
      if (res.ok) {
        toast.success('Email draft updated');
        setIsEditDraftOpen(false);
        fetchData();
        const updated = await res.json();
        setSelectedEmail(updated);
      }
    } catch (error) {
      toast.error('Failed to save changes');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendApproved = async (emailId: string) => {
    setSendLoading(true);
    try {
      const res = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          emailId, 
          fromEmail: selectedFromEmail === 'default' ? undefined : configs.find(c => c.id === selectedFromEmail)?.email,
          configId: selectedFromEmail === 'default' ? undefined : selectedFromEmail
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Email sent successfully');
        setIsActionOpen(false);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to send');
      }
    } catch (error) {
      toast.error('Network error while sending');
    } finally {
      setSendLoading(false);
    }
  };

  const handleGenerateBody = async () => {
    const sourceEmail = selectedFromEmail === 'default' ? 'default' : configs.find(c => c.id === selectedFromEmail)?.email;
    if (!sourceEmail) {
      toast.error("Please select a 'From' email address");
      return;
    }
    if (!composeData.subject) {
      toast.error('Please enter a subject first');
      return;
    }
    setGenLoading(true);
    try {
      const res = await fetch('/api/employee/generate-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          subject: composeData.subject,
          sourceEmail: sourceEmail
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setComposeData(prev => ({ ...prev, body: data.body }));
        toast.success('Email body generated');
      } else {
        toast.error(data.error || "Source email is required");
      }
    } catch (error) {
      toast.error('Failed to generate email');
    } finally {
      setGenLoading(false);
    }
  };

  const handleSendCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    const sourceEmail = selectedFromEmail;
    if (!sourceEmail) {
      toast.error("Please select a 'From' email address");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/employee/send-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          recipientEmail: composeData.to,
          subject: composeData.subject,
          body: composeData.body,
          sourceEmail: selectedFromEmail === 'default' ? undefined : configs.find(c => c.id === selectedFromEmail)?.email,
          configId: selectedFromEmail === 'default' ? undefined : selectedFromEmail
        }),
      });
      if (res.ok) {
        toast.success('Email sent successfully');
        setIsComposeOpen(false);
        setComposeData({ subject: '', body: '', to: '' });
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to send email');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'APPROVED': return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'REJECTED': return <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      case 'SENT': return <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-200"><Send className="w-3 h-3 mr-1" /> Sent</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="page-title">
            <h1 className="text-3xl font-bold text-[#1e293b] tracking-tight">Email Monitoring</h1>
            <p className="text-[#64748b] mt-1">Review and approve employee email requests.</p>
          </div>
          <div className="header-actions flex gap-3">
            <Button variant="outline" onClick={fetchData} className="bg-white border-[#e2e8f0] text-[#1e293b] rounded-lg px-5 h-10 font-semibold shadow-sm hover:bg-slate-50">
              Refresh
            </Button>
            <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
              <DialogTrigger
                render={
                  <Button className="bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-lg px-5 h-10 font-semibold shadow-sm shadow-indigo-100">
                    <Send className="w-4 h-4 mr-2" />
                    Compose
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-[600px] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <DialogTitle className="text-xl font-bold text-[#1e293b]">Compose New Email</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSendCompose} className="p-8 space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Recipient Email</Label>
                    <Input 
                      placeholder="client@example.com" 
                      value={composeData.to}
                      onChange={(e) => setComposeData({...composeData, to: e.target.value})}
                      className="rounded-xl border-[#e2e8f0]"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Email Subject</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Meeting Request" 
                        value={composeData.subject}
                        onChange={(e) => setComposeData({...composeData, subject: e.target.value})}
                        className="rounded-xl border-[#e2e8f0]"
                        required
                      />
                      <Button 
                        type="button"
                        onClick={handleGenerateBody} 
                        disabled={genLoading || !composeData.subject}
                        className={cn(
                          "rounded-xl px-4 whitespace-nowrap transition-all",
                          !composeData.subject 
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                            : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100"
                        )}
                      >
                        {genLoading ? '...' : <><Sparkles className="w-4 h-4 mr-2" /> Generate Body</>}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Email Body</Label>
                    <Textarea 
                      placeholder="Email content..." 
                      value={composeData.body}
                      onChange={(e) => setComposeData({...composeData, body: e.target.value})}
                      className="min-h-[200px] rounded-xl border-[#e2e8f0]"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Send From</Label>
                    <Select onValueChange={(val) => setSelectedFromEmail(val || '')} value={selectedFromEmail}>
                      <SelectTrigger className="w-full rounded-2xl border-[#e2e8f0] h-12 bg-[#f8fafc] text-[#64748b] font-medium shadow-none focus:ring-[#6366f1] px-4">
                        <SelectValue placeholder="Select sender email" />
                      </SelectTrigger>
                      <SelectContent className="bg-white rounded-xl">
                        <SelectItem value="default">Default SMTP (.env)</SelectItem>
                        {configs.map(config => (
                          <SelectItem key={config.id} value={config.id}>{config.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-xl py-6 font-bold shadow-lg shadow-indigo-100">
                    {isSubmitting ? 'Sending...' : 'Send Email'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {/* Mobile Email List (Visible only on mobile) */}
        <div className="block md:hidden">
          {loading ? (
            <div className="text-center py-12 text-[#64748b]">Loading emails...</div>
          ) : emails.length === 0 ? (
            <div className="text-center py-12 text-[#64748b]">No emails found.</div>
          ) : (
            <div className="bg-white border-y border-[#e2e8f0] divide-y divide-[#e2e8f0]">
              {emails.map((email) => (
                <div key={email.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full bg-[#f1f5f9] flex items-center justify-center text-[#6366f1] text-[10px] font-bold">
                        {email.employee ? email.employee.name[0] : 'A'}
                      </div>
                      <span className="text-xs font-bold text-[#1e293b] truncate">
                        {email.employee ? email.employee.name : 'Admin'}
                      </span>
                      {getStatusBadge(email.status)}
                    </div>
                    <p className="text-sm font-medium text-[#64748b] truncate italic">
                      &quot;{email.subject}&quot;
                    </p>
                  </div>
                  
                  <Dialog open={isActionOpen && selectedEmail?.id === email.id} onOpenChange={(open) => {
                    setIsActionOpen(open);
                    if (open) {
                      setSelectedEmail(email);
                      setAdminComment(email.adminComment || '');
                      setSelectedFromEmail(email.configId || 'default');
                    }
                  }}>
                    <DialogTrigger
                      render={
                        <Button variant="ghost" size="icon" className="text-[#6366f1] bg-indigo-50 rounded-full h-10 w-10 flex-shrink-0">
                          <Eye className="w-4 h-4" />
                        </Button>
                      }
                    />
                    <DialogContent className="w-[95vw] max-w-[600px] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
                      <DialogHeader className="px-6 py-4 bg-[#f8fafc] border-b border-[#e2e8f0]">
                        <DialogTitle className="text-lg font-bold text-[#1e293b]">Review Request</DialogTitle>
                      </DialogHeader>
                      <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Employee</p>
                              <p className="text-sm font-semibold text-[#1e293b]">{email.employee?.name || 'Admin'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Recipient (To)</p>
                              <p className="text-sm text-[#64748b] font-bold">{email.to}</p>
                            </div>
                          </div>
                          
                          {email.cc && (
                            <div>
                              <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">CC</p>
                              <p className="text-sm text-[#64748b]">{email.cc}</p>
                            </div>
                          )}

                          <div className="p-4 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-3">
                            <div className="flex justify-between items-center">
                              <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Subject</p>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 text-[10px] font-bold text-[#6366f1] px-2"
                                onClick={() => {
                                  setEditDraftData({ subject: email.subject, body: email.body });
                                  setIsEditDraftOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                            </div>
                            <p className="text-sm font-bold text-[#1e293b]">{email.subject}</p>
                            <div className="pt-2 border-t border-[#e2e8f0]">
                              <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-2">Message Body</p>
                              <div className="text-xs text-[#334155] italic whitespace-pre-wrap leading-relaxed">
                                {email.body}
                              </div>
                            </div>
                          </div>
                        </div>

                        {email.status === 'PENDING' && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Admin Comment</Label>
                              <Textarea 
                                placeholder="Add optional feedback..." 
                                value={adminComment}
                                onChange={(e) => setAdminComment(e.target.value)}
                                className="min-h-[80px] rounded-xl border-[#e2e8f0] text-sm"
                              />
                            </div>
                            <div className="flex gap-3">
                              <Button disabled={isSubmitting} className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-xl h-12 font-bold" onClick={() => handleAction('APPROVED')}>
                                {isSubmitting ? '...' : 'Approve'}
                              </Button>
                              <Button disabled={isSubmitting} variant="outline" className="flex-1 border-rose-200 text-rose-600 rounded-xl h-12 font-bold" onClick={() => handleAction('REJECTED')}>
                                {isSubmitting ? '...' : 'Reject'}
                              </Button>
                            </div>
                          </div>
                        )}

                        {email.status === 'APPROVED' && (
                          <Button 
                            className="w-full bg-[#6366f1] text-white rounded-xl h-14 font-bold shadow-lg shadow-indigo-100"
                            onClick={() => handleSendApproved(email.id)}
                            disabled={sendLoading}
                          >
                            {sendLoading ? 'Sending...' : 'Send Now'}
                          </Button>
                        )}
                        
                        <div className="text-[10px] text-center text-[#94a3b8] pt-2">
                          ID: {email.id.slice(0, 8)} • {new Date(email.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Email Table (Hidden on mobile) */}
        <Card className="hidden md:block border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#fafafa] hover:bg-[#fafafa]">
                <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Employee Name</TableHead>
                <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Subject</TableHead>
                <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Status</TableHead>
                <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Date</TableHead>
                <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-[#64748b]">Loading emails...</TableCell></TableRow>
              ) : emails.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-[#64748b]">No emails found.</TableCell></TableRow>
              ) : (
                emails.map((email) => (
                  <TableRow key={email.id} className="hover:bg-slate-50/50 border-b border-[#e2e8f0] transition-colors">
                    <TableCell className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#e2e8f0] flex items-center justify-center text-[#64748b] text-[10px] font-bold">
                          {email.employee ? email.employee.name[0] : 'A'}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-[#1e293b]">
                            {email.employee ? email.employee.name : 'System Admin'}
                          </span>
                          <span className="text-[10px] text-[#64748b]">
                            {email.employee ? email.employee.email : 'admin@system.com'}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-8 py-5 max-w-xs truncate text-sm font-medium text-[#1e293b]">{email.subject}</TableCell>
                    <TableCell className="px-8 py-5">{getStatusBadge(email.status)}</TableCell>
                    <TableCell className="px-8 py-5 text-[#64748b] text-xs">{new Date(email.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="px-8 py-5 text-right">
                      <Dialog open={isActionOpen && selectedEmail?.id === email.id} onOpenChange={(open) => {
                        setIsActionOpen(open);
                        if (open) {
                          setSelectedEmail(email);
                          setAdminComment(email.adminComment || '');
                          setSelectedFromEmail(email.configId || 'default');
                        }
                      }}>
                        <DialogTrigger
                          render={
                            <Button variant="ghost" size="sm" className="text-indigo-600 hover:bg-indigo-50 rounded-lg">
                              <Eye className="w-4 h-4 mr-2" />
                              Review
                            </Button>
                          }
                        />
                        <DialogContent className="sm:max-w-[700px] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
                          <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
                            <DialogTitle className="text-xl font-bold text-[#1e293b]">Review Email Request</DialogTitle>
                          </DialogHeader>
                           <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto">
                             <div className="p-6 bg-[#f8fafc] rounded-[24px] border border-[#e2e8f0] space-y-4 shadow-sm relative group">
                              <div className="grid grid-cols-2 gap-6 mb-4">
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">From (Suggested)</p>
                                  <p className="text-sm font-bold text-[#1e293b]">{email.fromEmail || 'Default'}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">To (Recipient)</p>
                                  <p className="text-sm font-bold text-indigo-600">{email.to}</p>
                                </div>
                                {email.cc && (
                                  <div className="space-y-1 col-span-2">
                                    <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">CC</p>
                                    <p className="text-sm text-[#475569]">{email.cc}</p>
                                  </div>
                                )}
                              </div>

                              <div className="flex justify-between items-start border-t border-slate-100 pt-4">
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Subject</p>
                                  <h3 className="text-lg font-bold text-[#1e293b]">{email.subject}</h3>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-[#64748b] hover:text-[#6366f1] hover:bg-white"
                                  onClick={() => {
                                    setEditDraftData({ subject: email.subject, body: email.body });
                                    setIsEditDraftOpen(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4 mr-2" /> Edit Draft
                                </Button>
                              </div>
                              <div className="pt-4 border-t border-slate-200">
                                <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-2">Message Body</p>
                                <div className="text-sm text-[#334155] whitespace-pre-wrap leading-relaxed bg-white p-6 rounded-xl border border-slate-100 italic shadow-inner min-h-[100px]">
                                  {email.body}
                                </div>
                              </div>
                            </div>
 
                            {email.status === 'PENDING' && (
                              <div className="space-y-6">
                                <div className="space-y-3">
                                  <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Admin Review Comment (Optional)</Label>
                                  <Textarea 
                                    placeholder="Add a comment for the employee..." 
                                    value={adminComment}
                                    onChange={(e) => setAdminComment(e.target.value)}
                                    className="min-h-[100px] rounded-2xl border-[#e2e8f0] focus:ring-[#6366f1] text-sm"
                                  />
                                </div>
 
                                <div className="flex gap-4 pt-2">
                                  <Button 
                                    disabled={isSubmitting}
                                    className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-xl py-6 font-bold shadow-sm shadow-emerald-100"
                                    onClick={() => handleAction('APPROVED')}
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    {isSubmitting ? 'Processing...' : 'Approve Email'}
                                  </Button>
                                  <Button 
                                    disabled={isSubmitting}
                                    variant="outline"
                                    className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl py-6 font-bold"
                                    onClick={() => handleAction('REJECTED')}
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    {isSubmitting ? '...' : 'Reject'}
                                  </Button>
                                </div>
                              </div>
                            )}
 
                            {email.status === 'APPROVED' && (
                              <div className="p-8 bg-indigo-50/50 rounded-[28px] border border-indigo-100 flex flex-col items-center text-center space-y-4">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-50">
                                  <CheckCircle className="w-6 h-6" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-[#1e293b]">Email is Approved</h4>
                                  <p className="text-sm text-[#64748b] mb-4">Confirm or change the sender before final delivery.</p>
                                  
                                  <div className="text-left space-y-2 mb-6">
                                    <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Final Sender Selection</Label>
                                    <Select onValueChange={(val) => setSelectedFromEmail(val || 'default')} value={selectedFromEmail}>
                                      <SelectTrigger className="w-full rounded-2xl border-[#e2e8f0] h-12 bg-[#f8fafc] text-[#64748b] font-medium shadow-none focus:ring-[#6366f1] px-4">
                                        <SelectValue placeholder="Select sender email" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-white rounded-xl">
                                        <SelectItem value="default">Default SMTP (.env)</SelectItem>
                                        {configs.map(config => (
                                          <SelectItem key={config.id} value={config.id}>{config.email}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <Button 
                                  className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-xl py-7 font-bold shadow-lg shadow-indigo-100"
                                  onClick={() => handleSendApproved(email.id)}
                                  disabled={sendLoading}
                                >
                                  {sendLoading ? 'Sending...' : <><Send className="w-5 h-5 mr-2" /> Send Email to {email.to}</>}
                                </Button>
                              </div>
                            )}
 
                            {email.status === 'REJECTED' && (
                              <div className="p-6 bg-rose-50 rounded-2xl border border-rose-100 flex items-center gap-4 text-rose-700">
                                <XCircle className="w-6 h-6" />
                                <p className="text-sm font-medium">This email has been rejected by an administrator.</p>
                              </div>
                            )}
 
                            {email.status === 'SENT' && (
                              <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-4 text-emerald-700">
                                <CheckCircle className="w-6 h-6" />
                                <p className="text-sm font-medium">This email has been successfully delivered.</p>
                              </div>
                            )}
 
                            {email.status !== 'PENDING' && (
                              <div className="p-5 bg-[#f8fafc] rounded-xl border border-[#e2e8f0]">
                                <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Admin Comment:</p>
                                <p className="text-sm text-[#1e293b] italic">{email.adminComment || 'No comment provided.'}</p>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={isEditDraftOpen} onOpenChange={setIsEditDraftOpen}>
        <DialogContent className="sm:max-w-[600px] bg-white rounded-[32px] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="px-10 py-8 bg-[#f8fafc] border-b border-[#e2e8f0]">
            <DialogTitle className="text-2xl font-bold text-[#1e293b]">Edit Email Draft</DialogTitle>
            <p className="text-sm text-[#64748b]">Modify the subject or body before approval.</p>
          </DialogHeader>
          <form onSubmit={handleUpdateDraft} className="p-10 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Email Subject</Label>
              <Input 
                value={editDraftData.subject}
                onChange={(e) => setEditDraftData({ ...editDraftData, subject: e.target.value })}
                className="h-12 rounded-xl border-[#e2e8f0] font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Email Body</Label>
              <Textarea 
                value={editDraftData.body}
                onChange={(e) => setEditDraftData({ ...editDraftData, body: e.target.value })}
                className="min-h-[300px] rounded-2xl border-[#e2e8f0] leading-relaxed"
              />
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-xl py-7 font-bold">
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsEditDraftOpen(false)} className="px-8 rounded-xl border-slate-200">
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
