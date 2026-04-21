'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, CheckCircle, XCircle, Eye, Send, CheckCircle2, MailOpen, MousePointerClick, Reply, AlertTriangle, ShieldAlert, UserMinus, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface Email {
  id: string;
  subject: string;
  body: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT';
  adminComment?: string;
  createdAt: string;
  to?: string;
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

type FilterStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT';

export default function StatusTrackingPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('ALL');
  const { token } = useAuth();

  const fetchEmails = async () => {
    try {
      const res = await fetch('/api/employee/emails', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setEmails(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchEmails();
  }, [token]);

  const counts = {
    ALL: emails.length,
    PENDING: emails.filter(e => e.status === 'PENDING').length,
    APPROVED: emails.filter(e => e.status === 'APPROVED').length,
    REJECTED: emails.filter(e => e.status === 'REJECTED').length,
    SENT: emails.filter(e => e.status === 'SENT').length,
  };

  const filteredEmails = activeFilter === 'ALL' ? emails : emails.filter(e => e.status === activeFilter);

  const filterTabs: { key: FilterStatus; label: string; icon: any; activeClass: string; countClass: string }[] = [
    { key: 'ALL', label: 'All', icon: Mail, activeClass: 'bg-[#6366f1] text-white border-[#6366f1]', countClass: 'bg-white/20 text-white' },
    { key: 'PENDING', label: 'Pending', icon: Clock, activeClass: 'bg-amber-500 text-white border-amber-500', countClass: 'bg-white/20 text-white' },
    { key: 'APPROVED', label: 'Approved', icon: CheckCircle, activeClass: 'bg-emerald-500 text-white border-emerald-500', countClass: 'bg-white/20 text-white' },
    { key: 'REJECTED', label: 'Rejected', icon: XCircle, activeClass: 'bg-rose-500 text-white border-rose-500', countClass: 'bg-white/20 text-white' },
    { key: 'SENT', label: 'Sent', icon: Send, activeClass: 'bg-blue-500 text-white border-blue-500', countClass: 'bg-white/20 text-white' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'APPROVED': return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'REJECTED': return <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      case 'SENT': return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200"><Send className="w-3 h-3 mr-1" /> Sent</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="page-title">
            <h1 className="text-2xl md:text-3xl font-bold text-[#1e293b] tracking-tight">Status Tracking</h1>
            <p className="text-[#64748b] mt-1 text-sm">Monitor the approval status of your sent emails.</p>
          </div>
        </header>

        {/* Clickable Filter Tabs (works on both mobile and desktop) */}
        <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar">
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

        {/* Email Table */}
        <Card className="border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#fafafa] hover:bg-[#fafafa]">
                  <TableHead className="px-4 md:px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Subject</TableHead>
                  <TableHead className="px-4 md:px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="hidden md:table-cell px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Sent Date</TableHead>
                  <TableHead className="px-4 md:px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-[#64748b]">Loading emails...</TableCell></TableRow>
                ) : filteredEmails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-[#64748b]">
                      No {activeFilter !== 'ALL' ? activeFilter.toLowerCase() : ''} emails found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmails.map((email) => (
                    <TableRow key={email.id} className="hover:bg-slate-50/50 border-b border-[#e2e8f0] transition-colors">
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
                                <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Subject</p>
                                <p className="text-sm font-semibold text-[#1e293b]">{email.subject}</p>
                                {email.to && (
                                  <>
                                    <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider pt-2">Recipient</p>
                                    <p className="text-sm text-[#1e293b]">{email.to}</p>
                                  </>
                                )}
                                <div className="pt-2 border-t border-[#e2e8f0]">
                                  <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Body:</p>
                                  <div className="text-sm text-[#1e293b] leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: email.body }}></div>
                                </div>
                              </div>
                              {email.adminComment && (
                                <div className="p-4 bg-[#eef2ff] border border-[#e0e7ff] rounded-xl">
                                  <p className="text-xs font-bold text-[#6366f1] uppercase tracking-wider mb-2">Admin Feedback:</p>
                                  <p className="text-sm text-[#4338ca] italic leading-relaxed">{email.adminComment}</p>
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
