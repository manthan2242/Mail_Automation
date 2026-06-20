'use client';

import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, CheckCircle, XCircle, Eye, Send, CheckCircle2, MailOpen, MousePointerClick, Reply, AlertTriangle, ShieldAlert, UserMinus, Mail, Paperclip, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Email {
  id: string;
  subject: string;
  body: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT' | 'SCHEDULED' | 'FAILED';
  adminComment?: string;
  createdAt: string;
  to?: string;
  cc?: string;
  bcc?: string;
  attachments?: string;
  scheduledAt?: string;
  employee?: { name: string; email: string };
}

interface Project {
  id: string;
  name: string;
  shortName?: string | null;
  shortName2?: string | null;
  clientId: string;
  client?: {
    id: string;
    name: string;
    primaryMail: string;
    secondaryMail?: string | null;
    optionalMail?: string | null;
  };
}

const statusLegend = [
  { term: 'Sent', desc: 'Email successfully sent from your system', icon: Send, color: 'text-blue-500', bg: 'bg-blue-50' },
  { term: 'Delivered', desc: "Reached recipient's inbox server", icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { term: 'Opened', desc: 'User opened the email', icon: MailOpen, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { term: 'Clicked', desc: 'User clicked a link inside email', icon: MousePointerClick, color: 'text-violet-500', bg: 'bg-violet-50' },
  { term: 'Replied', desc: 'User responded', icon: Reply, color: 'text-teal-500', bg: 'bg-teal-50' },
  { term: 'Bounced', desc: 'Email failed (invalid email / server issue)', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50' },
  { term: 'Spam/Blocked', desc: 'Marked as spam or blocked', icon: ShieldAlert, color: 'text-rose-500', bg: 'bg-rose-50' },
  { term: 'Unsubscribed', desc: 'User opted out', icon: UserMinus, color: 'text-slate-500', bg: 'bg-slate-50' },
];

type FilterStatus = 'ALL' | 'CLIENTS' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT' | 'SCHEDULED' | 'FAILED';

export default function StatusTrackingPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('ALL');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const { token } = useAuth();

  const fetchEmails = async () => {
    try {
      const [emailsRes, projectsRes, clientsRes] = await Promise.all([
        fetch('/api/employee/emails', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/employee/assigned-projects', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/employee/clients', {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);
      const emailsData = await emailsRes.json();
      const projectsData = await projectsRes.json();
      const clientsData = await clientsRes.json();
      
      setEmails(Array.isArray(emailsData) ? emailsData : []);
      setProjects(Array.isArray(projectsData?.projects) ? projectsData.projects : []);
      setAllClients(Array.isArray(clientsData) ? clientsData : []);
    } catch (error) {
      toast.error('Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchEmails();
  }, [token]);

  // Helper to extract email addresses from strings (e.g. "Name <email@domain.com>" or comma-separated lists)
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

  // Helper to find a Client record matching a given email address
  const getClientForEmail = (emailStr: string) => {
    const cleanEmail = emailStr.trim().toLowerCase();
    const matchedProject = projects.find(proj => {
      const client = proj.client;
      if (!client) return false;
      return (
        client.primaryMail?.trim().toLowerCase() === cleanEmail ||
        client.secondaryMail?.split(',').some(e => e.trim().toLowerCase() === cleanEmail) ||
        client.optionalMail?.split(',').some(e => e.trim().toLowerCase() === cleanEmail)
      );
    });
    return matchedProject?.client;
  };

  // Helper to identify if an email matches a project based on employee assigned projects and email subject
  const getMatchedProjectsForEmail = (email: Email): { clientName: string; projectName: string }[] => {
    const toEmails = getEmailsFromString(email.to);
    const ccEmails = getEmailsFromString(email.cc);
    const bccEmails = getEmailsFromString(email.bcc);
    const allEmails = [...toEmails, ...ccEmails, ...bccEmails];

    const matched: { clientName: string; projectName: string }[] = [];
    const cleanSubject = email.subject.toLowerCase();

    allEmails.forEach(emailStr => {
      const client = getClientForEmail(emailStr);
      if (client) {
        projects.forEach((project) => {
          if (project.clientId === client.id) {
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
          }
        });
      }
    });

    return matched;
  };

  const getClientsOnlyCount = () => {
    const clientEmailSet = new Set<string>();
    allClients.forEach(client => {
      if (client.primaryMail) clientEmailSet.add(client.primaryMail.trim().toLowerCase());
      if (client.secondaryMail) {
        client.secondaryMail.split(',').forEach((e: string) => {
          const trimmed = e.trim().toLowerCase();
          if (trimmed) clientEmailSet.add(trimmed);
        });
      }
      if (client.optionalMail) {
        client.optionalMail.split(',').forEach((e: string) => {
          const trimmed = e.trim().toLowerCase();
          if (trimmed) clientEmailSet.add(trimmed);
        });
      }
    });
    return emails.filter(email => {
      const recipients = getEmailsFromString(email.to);
      const ccRecs = getEmailsFromString(email.cc);
      const bccRecs = getEmailsFromString(email.bcc);
      const allRecs = [...recipients, ...ccRecs, ...bccRecs];
      return allRecs.some(rec => clientEmailSet.has(rec));
    }).length;
  };

  const getFilteredEmails = () => {
    let list = emails;
    if (activeFilter === 'CLIENTS') {
      const clientEmailSet = new Set<string>();
      allClients.forEach(client => {
        if (selectedClientId === 'all' || client.id === selectedClientId) {
          if (client.primaryMail) clientEmailSet.add(client.primaryMail.trim().toLowerCase());
          if (client.secondaryMail) {
            client.secondaryMail.split(',').forEach((e: string) => {
              const trimmed = e.trim().toLowerCase();
              if (trimmed) clientEmailSet.add(trimmed);
            });
          }
          if (client.optionalMail) {
            client.optionalMail.split(',').forEach((e: string) => {
              const trimmed = e.trim().toLowerCase();
              if (trimmed) clientEmailSet.add(trimmed);
            });
          }
        }
      });
      list = list.filter(email => {
        const recipients = getEmailsFromString(email.to);
        const ccRecs = getEmailsFromString(email.cc);
        const bccRecs = getEmailsFromString(email.bcc);
        const allRecs = [...recipients, ...ccRecs, ...bccRecs];
        return allRecs.some(rec => clientEmailSet.has(rec));
      });
    } else if (activeFilter !== 'ALL') {
      list = list.filter(e => e.status === activeFilter);
    }
    return list;
  };

  const counts = {
    ALL: emails.length,
    CLIENTS: getClientsOnlyCount(),
    PENDING: emails.filter(e => e.status === 'PENDING').length,
    APPROVED: emails.filter(e => e.status === 'APPROVED').length,
    REJECTED: emails.filter(e => e.status === 'REJECTED').length,
    SENT: emails.filter(e => e.status === 'SENT').length,
    SCHEDULED: emails.filter(e => e.status === 'SCHEDULED').length,
    FAILED: emails.filter(e => e.status === 'FAILED').length,
  };

  const filterTabs: { key: FilterStatus; label: string; icon: any; activeClass: string; countClass: string }[] = [
    { key: 'ALL', label: 'All Mails', icon: Mail, activeClass: 'bg-[#6366f1] text-white border-[#6366f1]', countClass: 'bg-white/20 text-white' },
    { key: 'CLIENTS', label: 'Client Mails', icon: Paperclip, activeClass: 'bg-indigo-600 text-white border-indigo-600', countClass: 'bg-white/20 text-white' },
    { key: 'PENDING', label: 'Pending', icon: Clock, activeClass: 'bg-amber-500 text-white border-amber-500', countClass: 'bg-white/20 text-white' },
    { key: 'APPROVED', label: 'Approved', icon: CheckCircle, activeClass: 'bg-emerald-500 text-white border-emerald-500', countClass: 'bg-white/20 text-white' },
    { key: 'REJECTED', label: 'Rejected', icon: XCircle, activeClass: 'bg-rose-500 text-white border-rose-500', countClass: 'bg-white/20 text-white' },
    { key: 'SENT', label: 'Sent', icon: Send, activeClass: 'bg-blue-500 text-white border-blue-500', countClass: 'bg-white/20 text-white' },
    { key: 'SCHEDULED', label: 'Scheduled', icon: Calendar, activeClass: 'bg-blue-500 text-white border-blue-500', countClass: 'bg-white/20 text-white' },
    { key: 'FAILED', label: 'Failed', icon: XCircle, activeClass: 'bg-rose-500 text-white border-rose-500', countClass: 'bg-white/20 text-white' },
  ];

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="page-title">
            <h1 className="text-2xl md:text-3xl font-bold text-[#1e293b] tracking-tight">Status Tracking</h1>
            <p className="text-xs md:text-sm text-[#64748b] mt-1">Monitor the approval status of your sent emails.</p>
          </div>
        </header>

        {/* Clickable Filter Tabs (Mobile only: paging snap layout) */}
        <div className="md:hidden flex overflow-x-auto snap-x snap-mandatory scroll-smooth gap-0 w-full pb-2">
          {/* Screen 1: first 4 filters */}
          <div className="w-full shrink-0 grid grid-cols-4 gap-1 px-1 snap-start">
            {filterTabs.slice(0, 4).map(tab => {
              const Icon = tab.icon;
              const isActive = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border text-[9px] font-bold transition-all active:scale-95 text-center ${
                    isActive
                      ? tab.activeClass
                      : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#6366f1] hover:text-[#6366f1]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate max-w-[65px]">{tab.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold shrink-0 ${
                    isActive ? tab.countClass : 'bg-[#f1f5f9] text-[#64748b]'
                  }`}>
                    {counts[tab.key]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Screen 2: next 4 filters */}
          <div className="w-full shrink-0 grid grid-cols-4 gap-1 px-1 snap-start">
            {filterTabs.slice(4).map(tab => {
              const Icon = tab.icon;
              const isActive = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border text-[9px] font-bold transition-all active:scale-95 text-center ${
                    isActive
                      ? tab.activeClass
                      : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#6366f1] hover:text-[#6366f1]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate max-w-[65px]">{tab.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold shrink-0 ${
                    isActive ? tab.countClass : 'bg-[#f1f5f9] text-[#64748b]'
                  }`}>
                    {counts[tab.key]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Clickable Filter Tabs (Desktop only: single line layout) */}
        <div className="hidden md:flex overflow-x-auto gap-2 pb-1 no-scrollbar">
          {filterTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                  isActive
                    ? tab.activeClass
                    : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#6366f1] hover:text-[#6366f1]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  isActive ? tab.countClass : 'bg-[#f1f5f9] text-[#64748b]'
                }`}>
                  {counts[tab.key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Client Selector Dropdown for Client Mails */}
        {activeFilter === 'CLIENTS' && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-4 rounded-[20px] border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
            <span className="text-xs font-bold text-[#64748b]">Filter by Client:</span>
            <Select value={selectedClientId} onValueChange={(val) => setSelectedClientId(val || 'all')}>
              <SelectTrigger className="w-full sm:w-[220px] h-9 rounded-xl border-[#e2e8f0] text-xs font-bold text-[#1e293b] bg-white transition-all">
                <SelectValue placeholder="Select a Client...">
                  {selectedClientId === 'all' 
                    ? 'All Clients' 
                    : allClients.find(c => c.id === selectedClientId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-[#e2e8f0]">
                <SelectItem value="all" className="text-xs font-semibold">All Clients</SelectItem>
                {allClients.map((client: any) => (
                  <SelectItem key={client.id} value={client.id} className="text-xs font-semibold">
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Email Table */}
        <Card className="border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#fafafa] hover:bg-[#fafafa]">
                  <TableHead className="px-4 md:px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Sender</TableHead>
                  <TableHead className="px-4 md:px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Recipient (To)</TableHead>
                  <TableHead className="px-4 md:px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Project</TableHead>
                  <TableHead className="px-4 md:px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Subject</TableHead>
                  <TableHead className="px-4 md:px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="hidden md:table-cell px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Sent Date</TableHead>
                  <TableHead className="px-4 md:px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-[#64748b]">Loading emails...</TableCell></TableRow>
                ) : getFilteredEmails().length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-[#64748b]">
                      No {activeFilter !== 'ALL' ? activeFilter.toLowerCase() : ''} emails found.
                    </TableCell>
                  </TableRow>
                ) : (
                  getFilteredEmails().map((email) => (
                    <TableRow key={email.id} className="hover:bg-slate-50/50 border-b border-[#e2e8f0] transition-colors">
                      <TableCell className="px-4 md:px-8 py-4 text-xs font-semibold text-[#1e293b]">
                        {email.employee ? email.employee.name : 'Unknown'}
                      </TableCell>
                      <TableCell className="px-4 md:px-8 py-4 text-xs text-[#1e293b] max-w-[140px] truncate" title={email.to || ''}>
                        {email.to || 'N/A'}
                        {email.cc && <div className="text-[10px] text-[#64748b] truncate">CC: {email.cc}</div>}
                        {email.bcc && <div className="text-[10px] text-[#64748b] truncate">BCC: {email.bcc}</div>}
                      </TableCell>
                      <TableCell className="px-4 md:px-8 py-4 text-xs">
                        {(() => {
                          const matchedProjects = getMatchedProjectsForEmail(email);
                          if (matchedProjects.length > 0) {
                            return (
                              <div className="flex flex-wrap gap-1">
                                {matchedProjects.map((mp, i) => (
                                  <Badge key={i} variant="outline" className="bg-[#eef2ff] text-[#4f46e5] border-[#c7d2fe] text-[9px] font-bold py-0 px-1">
                                    {mp.clientName} - {mp.projectName}
                                  </Badge>
                                ))}
                              </div>
                            );
                          }
                          return 'N/A';
                        })()}
                      </TableCell>
                      <TableCell className="px-4 md:px-8 py-4 max-w-[140px] md:max-w-xs truncate font-semibold text-[#1e293b] text-sm">{email.subject}</TableCell>
                      <TableCell className="px-4 md:px-8 py-4">{getStatusBadge(email.status)}</TableCell>
                      <TableCell className="hidden md:table-cell px-8 py-4 text-[#64748b] text-xs">{new Date(email.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="px-4 md:px-8 py-4 text-right">
                        <Dialog>
                          <DialogTrigger
                            render={
                              <Button variant="ghost" size="sm" className="text-[#6366f1] hover:bg-[#eef2ff] font-bold text-xs px-2 md:px-4">
                                <Eye className="w-4 h-4 md:mr-2" />
                                <span className="hidden md:inline">View Details</span>
                              </Button>
                            }
                          />
                          <DialogContent className="sm:max-w-[600px] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
                            <DialogHeader className="px-6 md:px-8 py-5 md:py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
                              <DialogTitle className="text-lg md:text-xl font-bold text-[#1e293b]">Email Details</DialogTitle>
                            </DialogHeader>
                            <div className="p-6 md:p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                              <div className="flex items-center justify-between">
                                {getStatusBadge(email.status)}
                                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">ID: {email.id.substring(0, 8)}</span>
                              </div>
                              <div className="p-4 md:p-5 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Sender</p>
                                    <p className="text-sm font-semibold text-[#1e293b] break-all">{email.employee?.name || 'Unknown'}</p>
                                    <p className="text-[10px] text-[#64748b] break-all">{email.employee?.email || ''}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Recipient (To)</p>
                                    <p className="text-sm font-semibold text-indigo-600 break-all">{email.to || 'N/A'}</p>
                                  </div>
                                  {email.cc && (
                                    <div className="sm:col-span-2">
                                      <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider">CC</p>
                                      <p className="text-xs text-[#475569] break-all">{email.cc}</p>
                                    </div>
                                  )}
                                  {email.bcc && (
                                    <div className="sm:col-span-2">
                                      <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider">BCC</p>
                                      <p className="text-xs text-[#475569] break-all">{email.bcc}</p>
                                    </div>
                                  )}
                                  {email.scheduledAt && (
                                    <div className="sm:col-span-2">
                                      <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Scheduled Send Time</p>
                                      <p className="text-sm font-semibold text-[#1e293b]">{new Date(email.scheduledAt).toLocaleString()}</p>
                                    </div>
                                  )}
                                  {(() => {
                                    const matchedProjects = getMatchedProjectsForEmail(email);
                                    if (matchedProjects.length > 0) {
                                      return (
                                        <div className="sm:col-span-2">
                                          <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Project</p>
                                          <div className="flex flex-wrap gap-1.5 mt-1">
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
                                </div>

                                <div className="pt-2 border-t border-[#e2e8f0]">
                                  <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Subject</p>
                                  <p className="text-sm font-semibold text-[#1e293b]">{email.subject}</p>
                                </div>

                                <div className="pt-2 border-t border-[#e2e8f0]">
                                  <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Body:</p>
                                  <div className="text-sm text-[#1e293b] leading-relaxed prose prose-sm max-w-none bg-white p-4 rounded-xl border border-slate-100 italic whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: typeof window !== 'undefined' ? DOMPurify.sanitize(email.body) : email.body }}></div>
                                </div>

                                {email.attachments && (() => {
                                  try {
                                    const atts = JSON.parse(email.attachments);
                                    if (Array.isArray(atts) && atts.length > 0) {
                                      return (
                                        <div className="pt-2 border-t border-[#e2e8f0]">
                                          <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Attachments ({atts.length})</p>
                                          <div className="flex flex-wrap gap-2">
                                            {atts.map((att: any, idx: number) => (
                                              <a
                                                key={idx}
                                                href={att.content}
                                                download={att.filename}
                                                className="flex items-center gap-1.5 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#475569] text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] transition-colors"
                                              >
                                                <Paperclip className="w-3.5 h-3.5" />
                                                <span className="truncate max-w-[150px]">{att.filename}</span>
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
                              {email.adminComment && (
                                <div className="p-4 bg-[#eef2ff] border border-[#e0e7ff] rounded-xl">
                                  <p className="text-xs font-bold text-[#6366f1] uppercase tracking-wider mb-2">Admin Feedback:</p>
                                  <p className="text-sm text-[#4338ca] italic leading-relaxed whitespace-pre-wrap">{email.adminComment}</p>
                                </div>
                              )}
                              <p className="text-[10px] text-[#94a3b8]">{new Date(email.createdAt).toLocaleString()}</p>
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
        </Card>

        {/* Desktop-only: Delivery Lifecycle Legend */}
        <div className="hidden md:block">
          <Card className="border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden">
            <div className="bg-[#f8fafc] px-6 py-4 border-b border-[#e2e8f0]">
              <h2 className="text-sm font-bold text-[#1e293b] uppercase tracking-wider">Email Delivery Lifecycle</h2>
            </div>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {statusLegend.map((item, id) => {
                  const Icon = item.icon;
                  return (
                    <div key={id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                      <div className={`p-2 rounded-lg ${item.bg} flex-shrink-0 mt-0.5`}>
                        <Icon className={`w-4 h-4 ${item.color}`} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#1e293b] mb-0.5">{item.term}</h4>
                        <p className="text-[10px] text-[#64748b] leading-tight">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
