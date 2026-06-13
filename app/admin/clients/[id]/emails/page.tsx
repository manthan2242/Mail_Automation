'use client';

import { use, useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Mail, 
  Paperclip, 
  Eye, 
  Search, 
  Calendar, 
  Briefcase, 
  User, 
  Clock, 
  Send, 
  CheckCircle, 
  XCircle,
  AlertCircle
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  shortName: string | null;
  shortName2: string | null;
}

interface Client {
  id: string;
  name: string;
  primaryMail: string;
  secondaryMail: string | null;
  optionalMail: string | null;
  projects: Project[];
}

interface Email {
  id: string;
  to: string;
  cc: string | null;
  bcc: string | null;
  fromEmail: string | null;
  subject: string;
  body: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT';
  senderId: string | null;
  adminSenderId: string | null;
  adminComment: string | null;
  attachments: string | null;
  createdAt: string;
  employee?: {
    name: string;
    email: string;
  } | null;
}

export default function ClientEmailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = use(params);
  const { token } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchClientEmails = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/clients/${clientId}/emails`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClient(data.client);
        setEmails(data.emails);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to fetch client emails');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error connecting to the database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientEmails();
  }, [token, clientId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': 
        return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'APPROVED': 
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'REJECTED': 
        return <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      case 'SENT': 
        return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200"><Send className="w-3 h-3 mr-1" /> Sent</Badge>;
      default: 
        return <Badge>{status}</Badge>;
    }
  };

  const getSenderName = (email: Email) => {
    if (email.adminSenderId) return 'Administrator';
    if (email.employee) return email.employee.name;
    return 'System / API';
  };

  const filteredEmails = emails.filter(e => {
    const query = searchQuery.toLowerCase();
    const sender = getSenderName(e).toLowerCase();
    const subject = e.subject.toLowerCase();
    const to = (e.to || '').toLowerCase();
    return sender.includes(query) || subject.includes(query) || to.includes(query);
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        
        {/* Navigation & Header */}
        <header className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Link href="/admin/clients">
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-indigo-600 rounded-xl px-2">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Directory
              </Button>
            </Link>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[#1e293b] tracking-tight flex items-center gap-2.5">
                <Mail className="w-8 h-8 text-indigo-500" />
                Client Mails
              </h1>
              <p className="text-[#64748b] mt-1">
                Viewing communication history for client: <span className="font-semibold text-slate-800">{client?.name || 'Loading...'}</span>
              </p>
            </div>
          </div>
        </header>

        {/* Client Profile Header Summary */}
        {client && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.02)] bg-white rounded-[24px]">
              <CardContent className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Primary Information</h4>
                  <p className="text-sm font-bold text-slate-800">{client.name}</p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {client.primaryMail}
                  </p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Alternate Configurations</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {client.secondaryMail && (
                      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] font-medium py-0.5 px-2">
                        {client.secondaryMail}
                      </Badge>
                    )}
                    {client.optionalMail && (
                      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] font-medium py-0.5 px-2">
                        {client.optionalMail}
                      </Badge>
                    )}
                    {!client.secondaryMail && !client.optionalMail && (
                      <span className="text-xs text-slate-400 italic">No alternate emails mapped</span>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Active Mapped Projects ({client.projects.length})</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {client.projects.map(p => (
                      <Badge key={p.id} className="bg-indigo-50 hover:bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md font-bold px-2 py-0.5 text-[9px]">
                        {p.name}
                      </Badge>
                    ))}
                    {client.projects.length === 0 && (
                      <span className="text-xs text-slate-400 italic">No projects registered yet</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Emails Listing */}
        <Card className="border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.02)] bg-white rounded-[24px] overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-bold text-slate-800 text-base">Client Communications Ledger</h3>
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search by subject, sender, to..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 border-slate-200 focus:border-indigo-500 rounded-xl text-xs h-9 bg-slate-50/50"
              />
            </div>
          </div>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-20 text-slate-400">Loading Client Ledger Records...</div>
            ) : filteredEmails.length === 0 ? (
              <div className="bg-white rounded-b-[24px] p-16 text-center flex flex-col items-center">
                <AlertCircle className="w-10 h-10 text-slate-300 mb-3" />
                <h3 className="font-bold text-slate-800 text-base">No Emails Logged</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">No email items were found matching this client's configured email addresses in the directory.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sender</TableHead>
                      <TableHead className="px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Recipients (To)</TableHead>
                      <TableHead className="px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Subject</TableHead>
                      <TableHead className="px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</TableHead>
                      <TableHead className="px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date Sent</TableHead>
                      <TableHead className="px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmails.map((email) => (
                      <TableRow key={email.id} className="hover:bg-slate-50/40 border-b border-slate-100 transition-colors">
                        <TableCell className="px-8 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                              {getSenderName(email).charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-slate-800">{getSenderName(email)}</span>
                              <span className="text-[9px] text-slate-400 font-mono">{email.employee?.email || 'Admin'}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-8 py-4 max-w-[200px] truncate" title={email.to || ''}>
                          <span className="text-xs font-medium text-indigo-600">{email.to || 'N/A'}</span>
                          {email.cc && <div className="text-[9px] text-slate-400 truncate">CC: {email.cc}</div>}
                          {email.bcc && <div className="text-[9px] text-slate-400 truncate">BCC: {email.bcc}</div>}
                        </TableCell>
                        <TableCell className="px-8 py-4 font-semibold text-slate-800 text-xs max-w-[200px] truncate" title={email.subject}>
                          {email.subject}
                        </TableCell>
                        <TableCell className="px-8 py-4">{getStatusBadge(email.status)}</TableCell>
                        <TableCell className="px-8 py-4 text-[#64748b] text-xs">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(email.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </TableCell>
                        <TableCell className="px-8 py-4 text-right">
                          <Dialog>
                            <DialogTrigger render={
                              <Button variant="ghost" size="sm" className="text-indigo-600 hover:bg-indigo-50 rounded-lg font-semibold text-xs">
                                <Eye className="w-4 h-4 mr-1.5" />
                                View
                              </Button>
                            } />
                            <DialogContent className="sm:max-w-[650px] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
                              <DialogHeader className="px-8 py-5 bg-[#f8fafc] border-b border-[#e2e8f0]">
                                <DialogTitle className="text-lg font-bold text-[#1e293b]">Communication Log Details</DialogTitle>
                              </DialogHeader>
                              <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
                                <div className="flex items-center justify-between">
                                  {getStatusBadge(email.status)}
                                  <span className="text-[10px] font-bold text-slate-400 font-mono">ID: {email.id}</span>
                                </div>
                                <div className="p-5 bg-[#f8fafc] rounded-xl border border-slate-100 space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Sender Profile</p>
                                      <p className="text-xs font-bold text-[#1e293b]">{getSenderName(email)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Destination</p>
                                      <p className="text-xs font-bold text-indigo-600">{email.to}</p>
                                    </div>
                                    {email.cc && (
                                      <div className="col-span-2">
                                        <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">CC</p>
                                        <p className="text-xs text-[#475569]">{email.cc}</p>
                                      </div>
                                    )}
                                    {email.bcc && (
                                      <div className="col-span-2">
                                        <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">BCC</p>
                                        <p className="text-xs text-[#475569]">{email.bcc}</p>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="pt-3 border-t border-slate-200/60">
                                    <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Subject Line</p>
                                    <p className="text-xs font-semibold text-slate-800">{email.subject}</p>
                                  </div>

                                  <div className="pt-3 border-t border-slate-200/60">
                                    <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-2">Message Body</p>
                                    <div 
                                      className="text-xs text-[#334155] leading-relaxed bg-white p-5 rounded-xl border border-slate-100 italic max-h-[220px] overflow-y-auto"
                                      dangerouslySetInnerHTML={{ __html: email.body }}
                                    />
                                  </div>

                                  {email.attachments && (() => {
                                    try {
                                      const atts = JSON.parse(email.attachments);
                                      if (Array.isArray(atts) && atts.length > 0) {
                                        return (
                                          <div className="pt-3 border-t border-slate-200/60">
                                            <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-2">Dispatched Attachments ({atts.length})</p>
                                            <div className="flex flex-wrap gap-2">
                                              {atts.map((att: any, idx: number) => (
                                                <a
                                                  key={idx}
                                                  href={att.content}
                                                  download={att.filename}
                                                  className="flex items-center gap-1.5 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#475569] text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] transition-colors"
                                                >
                                                  <Paperclip className="w-3.5 h-3.5 text-slate-400" />
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
                                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">Administrator SLA Notes</p>
                                    <p className="text-xs text-[#4338ca] italic leading-relaxed">{email.adminComment}</p>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
