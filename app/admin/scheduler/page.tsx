'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Send, Calendar, Eye, Trash2, Edit2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import ComposeModal from '@/components/dashboard/ComposeModal';
import DOMPurify from 'dompurify';

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
  attachments?: string;
  scheduledAt?: string;
  createdAt: string;
}

export default function AdminSchedulerPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  
  const { token } = useAuth();

  const fetchScheduledEmails = async () => {
    try {
      const res = await fetch('/api/admin/emails', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        // Filter out emails that are scheduled, pending (with a schedule date), or have failed/sent with a schedule date
        const scheduledData = data.filter(email => 
          email.scheduledAt !== null || 
          email.status === 'SCHEDULED'
        );
        setEmails(scheduledData);
      } else {
        toast.error('Failed to load scheduled emails');
      }
    } catch (err) {
      toast.error('Failed to load scheduled emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchScheduledEmails();
  }, [token]);

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel and delete this scheduled email?')) return;
    try {
      const res = await fetch('/api/admin/emails', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        toast.success('Scheduled email cancelled successfully');
        fetchScheduledEmails();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to cancel email');
      }
    } catch (err) {
      toast.error('Failed to cancel email');
    }
  };

  const handleReschedule = async () => {
    if (!selectedEmail || !newDate || !newTime) {
      toast.error('Please specify both date and time');
      return;
    }

    const [year, month, day] = newDate.split('-').map(Number);
    const [hour, minute] = newTime.split(':').map(Number);
    const dt = new Date(year, month - 1, day, hour, minute);

    if (isNaN(dt.getTime()) || dt.getTime() <= Date.now()) {
      toast.error('New schedule time must be in the future');
      return;
    }

    try {
      const res = await fetch('/api/admin/emails', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: selectedEmail.id,
          scheduledAt: dt.toISOString(),
          // keep existing status but if it was SCHEDULED we ensure it stays so
          status: selectedEmail.status === 'PENDING' ? 'PENDING' : 'SCHEDULED'
        })
      });

      if (res.ok) {
        toast.success('Email rescheduled successfully');
        setIsRescheduleOpen(false);
        fetchScheduledEmails();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to reschedule email');
      }
    } catch (err) {
      toast.error('Failed to reschedule email');
    }
  };
  
  const handleApprove = async (id: string) => {
    setIsApproving(true);
    try {
      const res = await fetch('/api/admin/emails', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id,
          status: 'APPROVED'
        })
      });
      if (res.ok) {
        toast.success('Email approved successfully');
        setSelectedEmail(null);
        fetchScheduledEmails();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to approve email');
      }
    } catch (err) {
      toast.error('Failed to approve email');
    } finally {
      setIsApproving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': 
        return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] px-1.5 py-0.5"><Clock className="hidden sm:inline w-3 h-3 mr-1 animate-pulse" /> Pending Approval</Badge>;
      case 'SCHEDULED': 
        return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-[10px] px-1.5 py-0.5"><Calendar className="hidden sm:inline w-3 h-3 mr-1 animate-pulse" /> Scheduled</Badge>;
      case 'SENT': 
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[10px] px-1.5 py-0.5"><CheckCircle className="hidden sm:inline w-3 h-3 mr-1" /> Sent</Badge>;
      case 'FAILED': 
        return <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200 text-[10px] px-1.5 py-0.5"><XCircle className="hidden sm:inline w-3 h-3 mr-1" /> Failed</Badge>;
      default: 
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">{status}</Badge>;
    }
  };

  // Stats calculation
  const totalActive = emails.filter(e => e.status === 'SCHEDULED').length;
  const totalPending = emails.filter(e => e.status === 'PENDING').length;
  const next24Hrs = emails.filter(e => {
    if (e.status !== 'SCHEDULED' || !e.scheduledAt) return false;
    const diff = new Date(e.scheduledAt).getTime() - Date.now();
    return diff > 0 && diff <= 24 * 60 * 60 * 1000;
  }).length;

  return (
    <DashboardLayout>
      <div className="space-y-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="page-title">
            <h1 className="text-2xl md:text-3xl font-bold text-[#1e293b] tracking-tight">Email Scheduler</h1>
            <p className="text-xs md:text-sm text-[#64748b] mt-1">Manage and track scheduled emails across the organization.</p>
          </div>
          <div className="header-actions flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={fetchScheduledEmails} 
              className="hidden md:inline-flex bg-white border-[#e2e8f0] text-[#1e293b] rounded-lg px-5 h-10 font-semibold shadow-sm hover:bg-slate-50"
            >
              Refresh
            </Button>
            {/* Desktop Schedule Email Button */}
            <Button 
              onClick={() => setIsComposeOpen(true)}
              className="hidden md:inline-flex bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-lg px-5 h-10 font-semibold shadow-sm shadow-indigo-100"
            >
              <Send className="w-4 h-4 mr-2" />
              Schedule Email
            </Button>

            {/* Mobile Floating Action Button with Label Below */}
            <div className="md:hidden fixed bottom-24 right-4 z-40 flex flex-col items-center gap-1">
              <Button 
                onClick={() => setIsComposeOpen(true)}
                className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center bg-[#6366f1] hover:bg-[#4f46e5] active:scale-95 transition-all text-white p-0 border-none"
              >
                <Send className="w-5 h-5" />
              </Button>
              <span className="text-[9px] font-bold text-[#6366f1] bg-white/95 px-2 py-0.5 rounded-full shadow-sm border border-[#e2e8f0] tracking-wide whitespace-nowrap">
                Schedule Mail
              </span>
            </div>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-2 md:gap-6">
          <Card className="border border-[#e2e8f0] shadow-sm bg-white rounded-2xl py-2.5 md:py-4 gap-1 md:gap-4">
            <CardHeader className="flex flex-row items-center justify-between px-2.5 md:px-6 pb-0 md:pb-2">
              <CardTitle className="text-[9px] md:text-xs font-bold text-[#64748b] uppercase tracking-wider line-clamp-2 min-h-[20px] md:min-h-0 flex items-center">
                Active<span className="hidden md:inline">&nbsp;Schedules</span>
              </CardTitle>
              <Calendar className="hidden md:block w-5 h-5 text-indigo-500 shrink-0" />
            </CardHeader>
            <CardContent className="px-2.5 md:px-6">
              <div className="text-base md:text-2xl font-bold text-[#1e293b]">{totalActive}</div>
              <p className="hidden md:block text-xs text-[#64748b] mt-1">Ready for automatic dispatch</p>
            </CardContent>
          </Card>

          <Card className="border border-[#e2e8f0] shadow-sm bg-white rounded-2xl py-2.5 md:py-4 gap-1 md:gap-4">
            <CardHeader className="flex flex-row items-center justify-between px-2.5 md:px-6 pb-0 md:pb-2">
              <CardTitle className="text-[9px] md:text-xs font-bold text-[#64748b] uppercase tracking-wider line-clamp-2 min-h-[20px] md:min-h-0 flex items-center">
                Next&nbsp;24h<span className="hidden md:inline">ours</span>
              </CardTitle>
              <Clock className="hidden md:block w-5 h-5 text-[#6366f1] shrink-0" />
            </CardHeader>
            <CardContent className="px-2.5 md:px-6">
              <div className="text-base md:text-2xl font-bold text-[#1e293b]">{next24Hrs}</div>
              <p className="hidden md:block text-xs text-[#64748b] mt-1">Sending within 24 hours</p>
            </CardContent>
          </Card>

          <Card className="border border-[#e2e8f0] shadow-sm bg-white rounded-2xl py-2.5 md:py-4 gap-1 md:gap-4">
            <CardHeader className="flex flex-row items-center justify-between px-2.5 md:px-6 pb-0 md:pb-2">
              <CardTitle className="text-[9px] md:text-xs font-bold text-[#64748b] uppercase tracking-wider line-clamp-2 min-h-[20px] md:min-h-0 flex items-center">
                Pending<span className="hidden md:inline">&nbsp;Approval</span>
              </CardTitle>
              <AlertCircle className="hidden md:block w-5 h-5 text-amber-500 shrink-0" />
            </CardHeader>
            <CardContent className="px-2.5 md:px-6">
              <div className="text-base md:text-2xl font-bold text-[#1e293b]">{totalPending}</div>
              <p className="hidden md:block text-xs text-[#64748b] mt-1">Awaiting administrator review</p>
            </CardContent>
          </Card>
        </div>

        {/* Desktop Scheduled List */}
        <Card className="border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[600px] md:min-w-full">
              <TableHeader>
                <TableRow className="bg-[#fafafa] hover:bg-[#fafafa]">
                  <TableHead className="px-3 md:px-4 py-3 md:py-4 text-[10px] md:text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Sender</TableHead>
                  <TableHead className="px-3 md:px-4 py-3 md:py-4 text-[10px] md:text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Recipient</TableHead>
                  <TableHead className="px-3 md:px-4 py-3 md:py-4 text-[10px] md:text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Subject</TableHead>
                  <TableHead className="px-3 md:px-4 py-3 md:py-4 text-[10px] md:text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Scheduled Time</TableHead>
                  <TableHead className="px-3 md:px-4 py-3 md:py-4 text-[10px] md:text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="px-3 md:px-4 py-3 md:py-4 text-[10px] md:text-[11px] font-bold text-[#64748b] uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-[#64748b]">Loading scheduled emails...</TableCell></TableRow>
                ) : emails.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-[#64748b]">No scheduled emails found.</TableCell></TableRow>
                ) : (
                  emails.map((email) => (
                    <TableRow key={email.id} className="hover:bg-slate-50/50 border-b border-[#e2e8f0] transition-colors">
                      <TableCell className="px-3 md:px-4 py-3 md:py-5">
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className="hidden sm:flex w-8 h-8 rounded-full bg-[#e2e8f0] items-center justify-center text-[#64748b] text-[10px] font-bold shrink-0">
                            {email.employee ? email.employee.name[0] : 'A'}
                          </div>
                          <div className="flex flex-col min-w-0 max-w-[120px] md:max-w-[150px]">
                            <span className="text-xs md:text-sm font-semibold text-[#1e293b] leading-tight truncate">
                              {email.employee ? email.employee.name : 'Admin'}
                            </span>
                            <span className="text-[10px] text-[#64748b] truncate">
                              {email.employee ? email.employee.email : 'admin@system.com'}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 md:px-4 py-3 md:py-5">
                        <div className="flex flex-col gap-1 max-w-[120px] md:max-w-[180px]">
                          {email.to.split(',').map((recipient, i) => (
                            <div key={i} className="text-xs md:text-sm text-[#1e293b] font-semibold truncate break-all" title={recipient.trim()}>
                              {recipient.trim()}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 md:px-4 py-3 md:py-5 max-w-[120px] md:max-w-[180px] truncate text-xs md:text-sm font-medium text-[#1e293b]" title={email.subject}>{email.subject}</TableCell>
                      <TableCell className="px-3 md:px-4 py-3 md:py-5">
                        {email.scheduledAt ? (
                          <div className="text-xs md:text-sm text-[#475569] font-medium leading-tight whitespace-nowrap">
                            <div>{new Date(email.scheduledAt).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' })}</div>
                            <div className="text-[10px] md:text-[11px] text-slate-400 mt-0.5">{new Date(email.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        ) : 'Not Scheduled'}
                      </TableCell>
                      <TableCell className="px-3 md:px-4 py-3 md:py-5">{getStatusBadge(email.status)}</TableCell>
                      <TableCell className="px-3 md:px-4 py-3 md:py-5 text-right">
                        <div className="flex justify-end space-x-0.5 md:space-x-1">
                          <Dialog open={selectedEmail?.id === email.id && !isRescheduleOpen} onOpenChange={(open) => {
                            if (!open) setSelectedEmail(null);
                            else setSelectedEmail(email);
                          }}>
                            <DialogTrigger
                              render={
                                <Button variant="ghost" size="icon" className="text-indigo-600 hover:bg-indigo-50 rounded-lg w-8 h-8 md:w-9 md:h-9">
                                  <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                </Button>
                              }
                            />
                            <DialogContent className="w-[calc(100%-32px)] sm:max-w-[600px] max-h-[90vh] flex flex-col bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
                              <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0] flex-shrink-0">
                                <DialogTitle className="text-xl font-bold text-[#1e293b]">Scheduled Email Details</DialogTitle>
                              </DialogHeader>
                              <div className="p-8 space-y-6 flex-1 overflow-y-auto">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Creator</p>
                                    <p className="text-sm font-semibold text-[#1e293b]">{email.employee?.name || 'Admin'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Recipient</p>
                                    <div className="flex flex-col gap-1 mt-1">
                                      {email.to.split(',').map((recipient, i) => (
                                        <p key={i} className="text-sm font-semibold text-indigo-600 break-all">
                                          {recipient.trim()}
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Scheduled Time</p>
                                    <p className="text-sm text-[#1e293b] font-medium">
                                      {email.scheduledAt ? new Date(email.scheduledAt).toLocaleString() : '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Status</p>
                                    <div>{getStatusBadge(email.status)}</div>
                                  </div>
                                </div>
                                <div className="p-4 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-2">
                                  <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Subject</p>
                                  <p className="text-sm font-bold text-[#1e293b]">{email.subject}</p>
                                </div>
                                <div className="p-4 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-2">
                                  <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Message Body</p>
                                  <div className="text-xs text-[#334155] whitespace-pre-wrap leading-relaxed italic" dangerouslySetInnerHTML={{ __html: typeof window !== 'undefined' ? DOMPurify.sanitize(email.body) : email.body }}></div>
                                </div>
                              </div>
                              {email.status === 'PENDING' && (
                                <div className="px-8 py-4 bg-[#f8fafc] border-t border-[#e2e8f0] flex justify-end gap-3 flex-shrink-0">
                                  <Button 
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold px-4 h-9 shadow-sm"
                                    onClick={() => handleApprove(email.id)}
                                    disabled={isApproving}
                                  >
                                    {isApproving ? 'Approving...' : 'Approve Email'}
                                  </Button>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>

                          {(email.status === 'SCHEDULED' || email.status === 'PENDING') && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-indigo-600 hover:bg-indigo-50 rounded-lg w-8 h-8 md:w-9 md:h-9"
                                onClick={() => {
                                  setSelectedEmail(email);
                                  if (email.scheduledAt) {
                                    const dateObj = new Date(email.scheduledAt);
                                    setNewDate(dateObj.toISOString().split('T')[0]);
                                    setNewTime(dateObj.toTimeString().split(' ')[0].substring(0, 5));
                                  }
                                  setIsRescheduleOpen(true);
                                }}
                                title="Reschedule"
                              >
                                <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-rose-600 hover:bg-rose-50 rounded-lg w-8 h-8 md:w-9 md:h-9"
                                onClick={() => handleCancel(email.id)}
                                title="Cancel schedule"
                              >
                                <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Reschedule Modal */}
      {isRescheduleOpen && (
        <div className="fixed inset-0 bg-black/50 z-[250] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[360px] rounded-2xl p-6 shadow-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-950 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Reschedule Send
            </h3>
            <p className="text-xs text-gray-500 mb-6">Change the date and time this email is scheduled to send.</p>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Select Date</label>
                <input 
                  type="date" 
                  value={newDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Select Time</label>
                <input 
                  type="time" 
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-600"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <Button 
                variant="outline" 
                className="flex-1 rounded-xl text-xs font-semibold h-10 border-gray-200"
                onClick={() => setIsRescheduleOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-xl text-xs font-semibold h-10 shadow-sm"
                onClick={handleReschedule}
              >
                Update
              </Button>
            </div>
          </div>
        </div>
      )}

      {isComposeOpen && <ComposeModal onClose={() => { setIsComposeOpen(false); fetchScheduledEmails(); }} forceSchedule={true} />}
    </DashboardLayout>
  );
}
