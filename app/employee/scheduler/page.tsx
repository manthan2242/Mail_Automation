'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
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
  adminComment?: string;
  configId?: string;
  attachments?: string;
  scheduledAt?: string;
  createdAt: string;
}

export default function EmployeeSchedulerPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  
  const { token } = useAuth();

  const fetchScheduledEmails = async () => {
    try {
      const res = await fetch('/api/employee/emails', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        // Filter out emails that have a scheduledAt date
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
      const res = await fetch('/api/employee/emails', {
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
      // Employees resubmit scheduled email to DB - it stays PENDING for approval
      const res = await fetch('/api/employee/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientEmail: selectedEmail.to,
          cc: selectedEmail.cc,
          bcc: selectedEmail.bcc,
          subject: selectedEmail.subject,
          body: selectedEmail.body,
          sourceEmail: selectedEmail.fromEmail || '',
          configId: selectedEmail.configId,
          scheduledAt: dt.toISOString(),
          attachments: selectedEmail.attachments ? JSON.parse(selectedEmail.attachments) : undefined
        })
      });

      if (res.ok) {
        // Delete old one so we replace it with the new rescheduled request
        await fetch('/api/employee/emails', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ id: selectedEmail.id })
        });

        toast.success('Email rescheduled and submitted for approval successfully');
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': 
        return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200"><Clock className="w-3 h-3 mr-1 animate-pulse" /> Pending Approval</Badge>;
      case 'SCHEDULED': 
        return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200"><Calendar className="w-3 h-3 mr-1 animate-pulse" /> Approved & Scheduled</Badge>;
      case 'SENT': 
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200"><CheckCircle className="w-3 h-3 mr-1" /> Sent</Badge>;
      case 'FAILED': 
        return <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default: 
        return <Badge variant="outline">{status}</Badge>;
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
            <p className="text-xs md:text-sm text-[#64748b] mt-1">Manage and track your scheduled email dispatches.</p>
          </div>
          <div className="header-actions flex gap-3">
            <Button 
              variant="outline" 
              onClick={fetchScheduledEmails} 
              className="hidden md:inline-flex bg-white border-[#e2e8f0] text-[#1e293b] rounded-lg px-5 h-10 font-semibold shadow-sm hover:bg-slate-50"
            >
              Refresh
            </Button>
            <Button 
              onClick={() => setIsComposeOpen(true)}
              className="hidden md:inline-flex bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-lg px-5 h-10 font-semibold shadow-sm shadow-indigo-100"
            >
              <Send className="w-4 h-4 mr-2" />
              Schedule Email
            </Button>
          </div>
        </header>

        {/* Mobile Stats Row (Visible only on mobile) */}
        <div className="grid grid-cols-3 gap-2 md:hidden">
          <div className="bg-white border border-[#e2e8f0] p-3 rounded-xl flex flex-col items-center justify-center text-center shadow-sm">
            <span className="text-[9px] font-bold text-[#64748b] uppercase tracking-wider line-clamp-1">
              Approved
            </span>
            <span className="text-base font-bold text-[#1e293b] mt-0.5">
              {totalActive}
            </span>
          </div>
          <div className="bg-white border border-[#e2e8f0] p-3 rounded-xl flex flex-col items-center justify-center text-center shadow-sm">
            <span className="text-[9px] font-bold text-[#64748b] uppercase tracking-wider line-clamp-1">
              Next 24h
            </span>
            <span className="text-base font-bold text-[#1e293b] mt-0.5">
              {next24Hrs}
            </span>
          </div>
          <div className="bg-white border border-[#e2e8f0] p-3 rounded-xl flex flex-col items-center justify-center text-center shadow-sm">
            <span className="text-[9px] font-bold text-[#64748b] uppercase tracking-wider line-clamp-1">
              Pending
            </span>
            <span className="text-base font-bold text-[#1e293b] mt-0.5">
              {totalPending}
            </span>
          </div>
        </div>

        {/* Desktop Stats Cards */}
        <div className="hidden md:grid grid-cols-3 gap-6">
          <Card className="border border-[#e2e8f0] shadow-sm bg-white rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Approved & Scheduled</CardTitle>
              <Calendar className="w-5 h-5 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#1e293b]">{totalActive}</div>
              <p className="text-xs text-[#64748b] mt-1">Approved and ready to send</p>
            </CardContent>
          </Card>
          <Card className="border border-[#e2e8f0] shadow-sm bg-white rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Next 24 Hours</CardTitle>
              <Clock className="w-5 h-5 text-[#6366f1]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#1e293b]">{next24Hrs}</div>
              <p className="text-xs text-[#64748b] mt-1">Sending within 24 hours</p>
            </CardContent>
          </Card>
          <Card className="border border-[#e2e8f0] shadow-sm bg-white rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Awaiting Review</CardTitle>
              <AlertCircle className="w-5 h-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#1e293b]">{totalPending}</div>
              <p className="text-xs text-[#64748b] mt-1">Pending admin approval</p>
            </CardContent>
          </Card>
        </div>

        {/* Scheduled List */}
        <Card className="border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#fafafa] hover:bg-[#fafafa]">
                  <TableHead className="px-3 md:px-4 py-3 md:py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Recipient</TableHead>
                  <TableHead className="px-3 md:px-4 py-3 md:py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Subject</TableHead>
                  <TableHead className="px-3 md:px-4 py-3 md:py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Scheduled Time</TableHead>
                  <TableHead className="px-3 md:px-4 py-3 md:py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="px-3 md:px-4 py-3 md:py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-[#64748b]">Loading scheduled emails...</TableCell></TableRow>
                ) : emails.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-[#64748b]">No scheduled emails found.</TableCell></TableRow>
                ) : (
                  emails.map((email) => (
                    <TableRow key={email.id} className="hover:bg-slate-50/50 border-b border-[#e2e8f0] transition-colors">
                      <TableCell className="px-3 md:px-4 py-3 md:py-5">
                        <div className="flex flex-col gap-1 max-w-[120px] md:max-w-[180px]">
                          {email.to.split(',').map((recipient, i) => (
                            <div key={i} className="text-sm text-[#1e293b] font-semibold truncate break-all" title={recipient.trim()}>
                              {recipient.trim()}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 md:px-4 py-3 md:py-5 max-w-[120px] md:max-w-[180px] truncate text-sm font-medium text-[#1e293b]" title={email.subject}>{email.subject}</TableCell>
                      <TableCell className="px-3 md:px-4 py-3 md:py-5 text-sm text-[#475569] font-medium whitespace-nowrap">
                        {email.scheduledAt ? new Date(email.scheduledAt).toLocaleString() : 'Not Scheduled'}
                      </TableCell>
                      <TableCell className="px-3 md:px-4 py-3 md:py-5">{getStatusBadge(email.status)}</TableCell>
                      <TableCell className="px-3 md:px-4 py-3 md:py-5 text-right">
                        <div className="flex justify-end space-x-1">
                          <Dialog open={selectedEmail?.id === email.id && !isRescheduleOpen} onOpenChange={(open) => {
                            if (!open) setSelectedEmail(null);
                            else setSelectedEmail(email);
                          }}>
                            <DialogTrigger
                              render={
                                <Button variant="ghost" size="icon" className="text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                  <Eye className="w-4 h-4" />
                                </Button>
                              }
                            />
                            <DialogContent className="sm:max-w-[600px] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
                              <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
                                <DialogTitle className="text-xl font-bold text-[#1e293b]">Scheduled Email Details</DialogTitle>
                              </DialogHeader>
                              <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">From Email</p>
                                    <p className="text-sm font-medium text-slate-700 break-all">{email.fromEmail || 'Default SMTP'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Recipient (To)</p>
                                    <div className="flex flex-col gap-1 mt-1">
                                      {email.to.split(',').map((recipient, i) => (
                                        <p key={i} className="text-sm font-semibold text-indigo-600 break-all">
                                          {recipient.trim()}
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                {(email.cc || email.bcc) && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {email.cc && (
                                      <div>
                                        <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Cc</p>
                                        <div className="flex flex-col gap-1 mt-1">
                                          {email.cc.split(',').map((ccEmail, i) => (
                                            <p key={i} className="text-sm text-slate-600 break-all">
                                              {ccEmail.trim()}
                                            </p>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {email.bcc && (
                                      <div>
                                        <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Bcc</p>
                                        <div className="flex flex-col gap-1 mt-1">
                                          {email.bcc.split(',').map((bccEmail, i) => (
                                            <p key={i} className="text-sm text-slate-600 break-all">
                                              {bccEmail.trim()}
                                            </p>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {email.adminComment && (
                                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl space-y-1">
                                    <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Admin Comment</p>
                                    <p className="text-sm text-rose-800 italic font-semibold">{email.adminComment}</p>
                                  </div>
                                )}
                                <div className="p-4 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-2">
                                  <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Subject</p>
                                  <p className="text-sm font-bold text-[#1e293b]">{email.subject}</p>
                                </div>
                                <div className="p-4 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-2">
                                  <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Message Body</p>
                                  <div className="text-xs text-[#334155] whitespace-pre-wrap leading-relaxed italic" dangerouslySetInnerHTML={{ __html: typeof window !== 'undefined' ? DOMPurify.sanitize(email.body) : email.body }}></div>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          {(email.status === 'SCHEDULED' || email.status === 'PENDING') && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-indigo-600 hover:bg-indigo-50 rounded-lg"
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
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-rose-600 hover:bg-rose-50 rounded-lg"
                                onClick={() => handleCancel(email.id)}
                                title="Cancel schedule"
                              >
                                <Trash2 className="w-4 h-4" />
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

      {/* Mobile Schedule Email Floating Button (Bottom Right) */}
      <Button
        onClick={() => setIsComposeOpen(true)}
        className="md:hidden fixed bottom-[76px] right-4 z-40 bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-2xl h-10 px-4 font-bold shadow-[0_8px_20px_-4px_rgba(99,102,241,0.6)] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
      >
        <Send className="w-4 h-4" />
        Schedule Email
      </Button>

      {isComposeOpen && <ComposeModal onClose={() => { setIsComposeOpen(false); fetchScheduledEmails(); }} forceSchedule={true} />}
    </DashboardLayout>
  );
}
