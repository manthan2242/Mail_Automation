'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Mail, Settings, CheckCircle, Clock, AlertCircle, Sparkles, Menu, Eye, XCircle, Edit, Paperclip, Calendar, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import ComposeModal from '@/components/dashboard/ComposeModal';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';

interface Stats {
  totalEmployees: number;
  totalEmails: number;
  pendingEmails: number;
  approvedEmails: number;
  rejectedEmails: number;
  smtpConfigs: number;
}

interface Email {
  id: string;
  subject: string;
  body: string;
  to: string;
  cc?: string;
  bcc?: string;
  fromEmail?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT' | 'SCHEDULED' | 'FAILED';
  employee?: { name: string; email: string };
  adminComment?: string;
  configId?: string;
  config?: { email: string };
  attachments?: string;
  scheduledAt?: string;
  createdAt: string;
}

interface Config {
  id: string;
  email: string;
}

interface Project {
  id: string;
  name: string;
  shortName?: string | null;
  shortName2?: string | null;
  clientId: string;
}

interface Client {
  id: string;
  name: string;
  primaryMail: string;
  secondaryMail?: string | null;
  optionalMail?: string | null;
  projects?: Project[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [adminComment, setAdminComment] = useState('');
  const [selectedFromEmail, setSelectedFromEmail] = useState('');
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [isEditDraftOpen, setIsEditDraftOpen] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [editDraftData, setEditDraftData] = useState({ subject: '', body: '', to: '', cc: '', bcc: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { token, user } = useAuth();

  // Helper to extract email addresses from strings
  const getEmailsFromString = (str: string | null | undefined): string[] => {
    if (!str) return [];
    return str
      .split(',')
      .map(email => {
        const clean = email.trim();
        const match = /<([^>]+)>/.exec(clean);
        return (match ? match[1] : clean).trim().toLowerCase();
      })
      .filter(Boolean);
  };

  // Helper to convert HTML body from database to plain text with carriage returns for textarea editing
  const htmlToText = (html: string): string => {
    if (!html) return '';
    let text = html;
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<[^>]+>/g, '');
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    return text;
  };

  // Helper to convert plain text with carriage returns back to HTML format
  const textToHtml = (text: string): string => {
    if (!text) return '';
    return text.replace(/\n/g, '<br/>');
  };

  // Helper to find a Client record matching a given email address
  const getClientForEmail = (emailStr: string): Client | undefined => {
    const cleanEmail = emailStr.trim().toLowerCase();
    return clients.find(client => 
      client.primaryMail?.trim().toLowerCase() === cleanEmail ||
      client.secondaryMail?.split(',').some(e => e.trim().toLowerCase() === cleanEmail) ||
      client.optionalMail?.split(',').some(e => e.trim().toLowerCase() === cleanEmail)
    );
  };

  // Helper to identify if an email matches a project based on client projects and email subject
  const getMatchedProjectsForEmail = (email: Email): { clientName: string; projectName: string }[] => {
    const toEmails = getEmailsFromString(email.to);
    const ccEmails = getEmailsFromString(email.cc);
    const bccEmails = getEmailsFromString(email.bcc);
    const allEmails = [...toEmails, ...ccEmails, ...bccEmails];

    const matched: { clientName: string; projectName: string }[] = [];
    const cleanSubject = email.subject.toLowerCase();

    allEmails.forEach(emailStr => {
      const client = getClientForEmail(emailStr);
      if (client && client.projects) {
        client.projects.forEach((project) => {
          const cleanProjName = project.name.toLowerCase();
          const cleanShortName = project.shortName?.toLowerCase();
          const cleanShortName2 = project.shortName2?.toLowerCase();

          const fullMatch = cleanSubject.includes(cleanProjName);
          const shortMatch = cleanShortName ? cleanSubject.includes(cleanShortName) : false;
          const shortMatch2 = cleanShortName2 ? cleanSubject.includes(cleanShortName2) : false;

          if (fullMatch || shortMatch || shortMatch2) {
            if (!matched.some(m => m.projectName === project.name)) {
              matched.push({
                clientName: client.name,
                projectName: project.name
              });
            }
          }
        });
      }
    });

    return matched;
  };

  const fetchData = async () => {
    try {
      const [statsRes, emailsRes, configsRes, clientsRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/emails', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/email-configs', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/clients', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const statsData = await statsRes.json();
      const emailsData = await emailsRes.json();
      const configsData = await configsRes.json();
      const clientsData = await clientsRes.json();
      
      setStats(statsData);
      setEmails(Array.isArray(emailsData) ? emailsData.slice(0, 10) : []);
      setConfigs(Array.isArray(configsData) ? configsData : []);
      setClients(Array.isArray(clientsData) ? clientsData : []);
    } catch (error) {
      console.error(error);
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
      const data = await res.json();
      if (res.ok) {
        toast.success(`Email ${status.toLowerCase()} successfully`);
        setIsActionOpen(false);
        fetchData();
      } else {
        toast.error(data.error || `Failed to ${status.toLowerCase()} email`);
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
          body: textToHtml(editDraftData.body),
          to: editDraftData.to,
          cc: editDraftData.cc || null,
          bcc: editDraftData.bcc || null
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Email draft updated');
        setIsEditDraftOpen(false);
        fetchData();
        setSelectedEmail(data);
      } else {
        toast.error(data.error || 'Failed to save changes');
      }
    } catch (error) {
      toast.error('Failed to save changes');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendApproved = async (emailId: string) => {
    if (!selectedFromEmail) {
      toast.error('Please select a sender email configuration');
      return;
    }
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
          fromEmail: selectedFromEmail,
          configId: configs.find(c => c.email === selectedFromEmail)?.id
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'APPROVED': return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'REJECTED': return <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      case 'SENT': return <Badge variant="outline" className="bg-[#eef2ff] text-[#6366f1] border-[#c7d2fe]"><Send className="w-3 h-3 mr-1" /> Sent</Badge>;
      case 'SCHEDULED': return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200"><Calendar className="w-3 h-3 mr-1" /> Scheduled</Badge>;
      case 'FAILED': return <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const statCards = [
    { title: 'Pending Approval', value: stats?.pendingEmails || 0, icon: Clock, color: 'text-amber-500' },
    { title: 'Total Emails Sent', value: stats?.totalEmails || 0, icon: Mail, color: 'text-indigo-500' },
    { title: 'Active Team Members', value: stats?.totalEmployees || 0, icon: Users, color: 'text-blue-500' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 md:space-y-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="page-title flex items-center justify-between w-full md:w-auto md:block">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#1e293b] tracking-tight">Admin Console</h1>
              <p className="text-xs md:text-sm text-[#64748b] mt-1">Welcome back! Here&apos;s an overview of your system.</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden h-9 w-9 rounded-xl text-[#64748b] bg-white border border-[#e2e8f0] shadow-sm hover:bg-slate-50 shrink-0"
              onClick={() => window.dispatchEvent(new Event('open-mobile-menu'))}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
          <div className="header-actions flex gap-3">
            <Button 
               onClick={() => setIsComposeOpen(true)}
               className="hidden md:inline-flex bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-lg px-5 h-10 font-semibold shadow-sm shadow-indigo-100"
            >
              <Mail className="w-4 h-4 mr-2" />
              Compose Email
            </Button>
            <Link href="/admin/api-keys" className="hidden md:inline-block">
              <Button variant="outline" className="bg-white border-[#e2e8f0] text-[#1e293b] rounded-lg px-5 h-10 font-semibold shadow-sm hover:bg-slate-50">
                Generate API Key
              </Button>
            </Link>
          </div>
        </header>

        {/* Mobile Floating Compose Button */}
        <div className="md:hidden fixed bottom-24 right-4 z-40 flex flex-col items-center gap-1">
          <button
            onClick={() => setIsComposeOpen(true)}
            className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center bg-[#6366f1] hover:bg-[#4f46e5] active:scale-95 transition-all text-white p-0 border-none cursor-pointer"
            title="Compose Email"
          >
            <Mail className="w-5 h-5" />
          </button>
          <span className="text-[9px] font-bold text-[#6366f1] bg-white/95 px-2 py-0.5 rounded-full shadow-sm border border-[#e2e8f0] tracking-wide whitespace-nowrap">
            Compose Mail
          </span>
        </div>

        {isComposeOpen && <ComposeModal onClose={() => { setIsComposeOpen(false); fetchData(); }} />}

        {/* Mobile Stats Row (Visible only on mobile, no horizontal scrollbar) */}
        <div className="grid grid-cols-3 gap-2.5 md:hidden">
          {statCards.map((stat) => (
            <div key={stat.title} className="bg-white border border-[#e2e8f0] p-3 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm">
              <span className="text-[9px] font-bold text-[#64748b] uppercase tracking-wider line-clamp-2 min-h-[24px] flex items-center justify-center">
                {stat.title}
              </span>
              <span className="text-xl font-bold text-[#1e293b] mt-1">
                {loading ? '..' : stat.value}
              </span>
            </div>
          ))}
        </div>

        {/* Desktop Stats Grid (Hidden on mobile) */}
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden">
                <CardContent className="p-6">
                  <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-[0.05em] mb-2">{stat.title}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-light text-[#1e293b] tracking-tight">
                      {loading ? '...' : stat.value}
                    </p>
                    {stat.title === 'System Status' && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                        <span className="text-[10px] font-bold text-[#22c55e] uppercase">Online</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-3 border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden">
            <CardHeader className="px-6 md:px-8 py-5 md:py-6 border-b border-[#e2e8f0] flex flex-row items-center justify-between bg-white">
              <CardTitle className="text-lg font-bold text-[#1e293b]">Recent Email Activity</CardTitle>
              <Link href="/admin/emails">
                <Button variant="ghost" size="sm" className="text-[#6366f1] hover:bg-[#eef2ff] font-semibold text-xs">
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto w-full max-h-[350px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#fafafa] hover:bg-[#fafafa]">
                      <TableHead className="px-3 md:px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">
                        <span className="md:hidden">Sender</span>
                        <span className="hidden md:inline">Team Member Name</span>
                      </TableHead>
                      <TableHead className="px-3 md:px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">
                        <span className="md:hidden">Recipient</span>
                        <span className="hidden md:inline">Recipient (To)</span>
                      </TableHead>
                      <TableHead className="px-3 md:px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Subject</TableHead>
                      <TableHead className="px-3 md:px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Status</TableHead>
                      <TableHead className="px-3 md:px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Date</TableHead>
                      <TableHead className="px-3 md:px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-[#64748b]">Loading emails...</TableCell></TableRow>
                    ) : emails.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-[#64748b]">No emails found.</TableCell></TableRow>
                    ) : (
                      emails.map((email) => (
                        <TableRow key={email.id} className="hover:bg-slate-50/50 border-b border-[#e2e8f0] transition-colors">
                          <TableCell className="px-3 md:px-8 py-3.5 md:py-5">
                            <div className="flex items-center gap-1.5 md:gap-3">
                              <div className="hidden sm:flex w-8 h-8 rounded-full bg-[#e2e8f0] items-center justify-center text-[#64748b] text-[10px] font-bold shrink-0">
                                {email.employee ? email.employee.name[0] : 'A'}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs md:text-sm font-semibold text-[#1e293b] truncate">
                                  {email.employee ? email.employee.name : 'System Admin'}
                                </span>
                                <span className="text-[9px] md:text-[10px] text-[#64748b] truncate break-all max-w-[80px] md:max-w-none">
                                  {email.employee ? email.employee.email : 'admin@system.com'}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-3 md:px-8 py-3.5 md:py-5">
                            <div className="flex flex-col gap-1 max-w-[100px] md:max-w-[200px] min-w-0">
                              <span className="text-xs md:text-sm text-[#1e293b] truncate break-all" title={email.to || ''}>
                                {email.to || 'N/A'}
                              </span>
                              {email.cc && (
                                <span className="text-[9px] md:text-[10px] text-[#64748b] truncate break-all" title={`CC: ${email.cc}`}>
                                  CC: {email.cc}
                                </span>
                              )}
                              {email.bcc && (
                                <span className="text-[9px] md:text-[10px] text-[#64748b] truncate break-all" title={`BCC: ${email.bcc}`}>
                                  BCC: {email.bcc}
                                </span>
                              )}
                              {/* Display badges for client recipients */}
                              {email.to && (() => {
                                const toEmails = getEmailsFromString(email.to);
                                const ccEmails = getEmailsFromString(email.cc);
                                const bccEmails = getEmailsFromString(email.bcc);
                                const allEmails = [...toEmails, ...ccEmails, ...bccEmails];
                                const matchedClients = Array.from(new Set(
                                  allEmails
                                    .map(emailStr => getClientForEmail(emailStr))
                                    .filter((c): c is Client => !!c)
                                    .map(c => JSON.stringify({ id: c.id, name: c.name }))
                                )).map(s => JSON.parse(s) as { id: string; name: string });

                                if (matchedClients.length > 0) {
                                  return (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {matchedClients.map(c => (
                                        <Badge key={c.id} variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-100 text-[9px] py-0 px-1 font-medium">
                                          Client: {c.name}
                                        </Badge>
                                      ))}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="px-3 md:px-8 py-3.5 md:py-5 max-w-[110px] md:max-w-xs text-xs md:text-sm font-medium text-[#1e293b] whitespace-normal break-words leading-tight">
                            {email.subject}
                          </TableCell>
                          <TableCell className="px-3 md:px-8 py-3.5 md:py-5">{getStatusBadge(email.status)}</TableCell>
                          <TableCell className="px-3 md:px-8 py-3.5 md:py-5 text-[#64748b] text-[10px] md:text-xs">
                            <div className="flex flex-col font-medium">
                              <span>{new Date(email.createdAt).toLocaleDateString()}</span>
                              <span className="text-[9px] text-slate-400 mt-0.5">{new Date(email.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-3 md:px-8 py-3.5 md:py-5 text-right">
                            <Dialog open={isActionOpen && selectedEmail?.id === email.id} onOpenChange={(open) => {
                              setIsActionOpen(open);
                              if (open) {
                                setSelectedEmail(email);
                                setAdminComment(email.adminComment || '');
                                setSelectedFromEmail(email.config?.email || email.fromEmail || '');
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
                              <DialogContent className="w-[calc(100%-32px)] sm:max-w-[700px] max-h-[90vh] flex flex-col bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
                                <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0] flex-shrink-0">
                                  <DialogTitle className="text-xl font-bold text-[#1e293b]">Review Email Request</DialogTitle>
                                </DialogHeader>
                                <div className="p-8 space-y-8 flex-1 overflow-y-auto">
                                  <div className="p-6 bg-[#f8fafc] rounded-[24px] border border-[#e2e8f0] space-y-4 shadow-sm relative group">
                                    <div className="flex flex-col gap-4 mb-4">
                                      <div className="space-y-1 min-w-0">
                                        <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">From (Suggested)</p>
                                        <p className="text-sm font-bold text-[#1e293b] break-words">{email.fromEmail || 'Default'}</p>
                                      </div>
                                      <div className="space-y-1 min-w-0">
                                        <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">To (Recipient)</p>
                                        <p className="text-sm font-bold text-indigo-600 break-words">{email.to}</p>
                                      </div>
                                      {email.cc && (
                                        <div className="space-y-1 min-w-0">
                                          <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">CC</p>
                                          <p className="text-sm text-[#475569] break-words">{email.cc}</p>
                                        </div>
                                      )}
                                      {email.bcc && (
                                        <div className="space-y-1 min-w-0">
                                          <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">BCC</p>
                                          <p className="text-sm text-[#475569] break-words">{email.bcc}</p>
                                        </div>
                                      )}
                                      {email.scheduledAt && (
                                        <div className="space-y-1 col-span-2">
                                          <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Scheduled Send Time</p>
                                          <p className="text-sm font-bold text-indigo-600">{new Date(email.scheduledAt).toLocaleString()}</p>
                                        </div>
                                      )}

                                      {(() => {
                                        const matchedProjects = getMatchedProjectsForEmail(email);
                                        if (matchedProjects.length > 0) {
                                          return (
                                            <div className="space-y-1 col-span-2">
                                              <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Project</p>
                                              <div className="flex flex-wrap gap-2 mt-1">
                                                {matchedProjects.map((mp, i) => (
                                                  <Badge key={i} variant="outline" className="bg-[#eef2ff] text-[#4f46e5] border-[#c7d2fe] text-xs font-semibold px-2 py-0.5">
                                                    {mp.projectName} ({mp.clientName})
                                                  </Badge>
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}

                                      {email.attachments && (() => {
                                        try {
                                          const atts = JSON.parse(email.attachments);
                                          if (Array.isArray(atts) && atts.length > 0) {
                                            return (
                                              <div className="space-y-1 col-span-2 pt-2 border-t border-[#e2e8f0]">
                                                <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-2">Attachments ({atts.length})</p>
                                                <div className="flex flex-wrap gap-2">
                                                  {atts.map((att: any, idx: number) => (
                                                    <a
                                                      key={idx}
                                                      href={att.content}
                                                      download={att.filename}
                                                      className="flex items-center gap-1.5 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#475569] text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] transition-colors"
                                                    >
                                                      <Paperclip className="w-3.5 h-3.5" />
                                                      <span>{att.filename}</span>
                                                    </a>
                                                  ))}
                                                </div>
                                              </div>
                                            );
                                          }
                                        } catch (e) {}
                                        return null;
                                      })()}
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
                                          setEditDraftData({ 
                                            subject: email.subject, 
                                            body: htmlToText(email.body),
                                            to: email.to || '',
                                            cc: email.cc || '',
                                            bcc: email.bcc || ''
                                          });
                                          setIsEditDraftOpen(true);
                                        }}
                                      >
                                        <Edit className="w-4 h-4 mr-2" /> Edit Draft
                                      </Button>
                                    </div>
                                    <div className="pt-4 border-t border-slate-200">
                                      <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-2">Message Body</p>
                                      <div 
                                        className="text-sm text-[#334155] whitespace-pre-wrap leading-relaxed bg-white p-6 rounded-xl border border-slate-100 italic shadow-inner min-h-[100px]"
                                        dangerouslySetInnerHTML={{ __html: typeof window !== 'undefined' ? DOMPurify.sanitize(email.body) : email.body }}
                                      />
                                    </div>
                                  </div>

                                  {email.status === 'PENDING' && (
                                    <div className="space-y-6">
                                      <div className="space-y-3">
                                        <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Admin Review Comment (Optional)</Label>
                                        <Textarea 
                                          placeholder="Add a comment for the team member..." 
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
                                           <Select onValueChange={(val) => setSelectedFromEmail(val || '')} value={selectedFromEmail}>
                                            <SelectTrigger className="w-full rounded-2xl border-[#e2e8f0] h-12 bg-[#f8fafc] text-[#64748b] font-medium shadow-none focus:ring-[#6366f1] px-4">
                                              <SelectValue placeholder="Select sender email">
                                                {selectedFromEmail}
                                              </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent className="bg-white rounded-xl">
                                              {configs.map(config => (
                                                <SelectItem key={config.id} value={config.email}>{config.email}</SelectItem>
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

                                  {email.status === 'SCHEDULED' && (
                                    <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-4 text-blue-700">
                                      <Clock className="w-6 h-6" />
                                      <p className="text-sm font-medium">This email is approved and scheduled to send on {new Date(email.scheduledAt!).toLocaleString()}.</p>
                                    </div>
                                  )}

                                  {email.status === 'FAILED' && (
                                    <div className="p-6 bg-rose-50 rounded-2xl border border-rose-100 flex items-center gap-4 text-rose-700">
                                      <XCircle className="w-6 h-6" />
                                      <p className="text-sm font-medium">This email failed to send: {email.adminComment || 'SMTP error'}</p>
                                    </div>
                                  )}

                                  {email.status !== 'PENDING' && (
                                    <div className="p-5 bg-[#f8fafc] rounded-xl border border-[#e2e8f0]">
                                      <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Admin Comment:</p>
                                      <p className="text-sm text-[#1e293b] italic whitespace-pre-wrap">{email.adminComment || 'No comment provided.'}</p>
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
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isEditDraftOpen} onOpenChange={setIsEditDraftOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col bg-white rounded-[32px] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="px-10 py-8 bg-[#f8fafc] border-b border-[#e2e8f0] flex-shrink-0">
            <DialogTitle className="text-2xl font-bold text-[#1e293b]">Edit Email Draft</DialogTitle>
            <p className="text-sm text-[#64748b]">Modify the subject or body before approval.</p>
          </DialogHeader>
          <form onSubmit={handleUpdateDraft} className="flex-1 overflow-y-auto p-10 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Recipient (To)</Label>
              <Input 
                value={editDraftData.to}
                onChange={(e) => setEditDraftData({ ...editDraftData, to: e.target.value })}
                className="h-12 rounded-xl border-[#e2e8f0] font-medium"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">CC</Label>
                <Input 
                  value={editDraftData.cc}
                  onChange={(e) => setEditDraftData({ ...editDraftData, cc: e.target.value })}
                  className="h-12 rounded-xl border-[#e2e8f0] font-medium"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">BCC</Label>
                <Input 
                  value={editDraftData.bcc}
                  onChange={(e) => setEditDraftData({ ...editDraftData, bcc: e.target.value })}
                  className="h-12 rounded-xl border-[#e2e8f0] font-medium"
                />
              </div>
            </div>
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
