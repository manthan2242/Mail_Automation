'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Clock, CheckCircle, XCircle, Send, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import ComposeModal from '@/components/dashboard/ComposeModal';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export default function EmployeeDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const { user, token } = useAuth();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/employee/emails', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const emailsData = await res.json();
        setEmails(Array.isArray(emailsData) ? emailsData : []);
        
        const s = {
          total: emailsData.length,
          pending: emailsData.filter((e: any) => e.status === 'PENDING').length,
          approved: emailsData.filter((e: any) => e.status === 'APPROVED' || e.status === 'SENT').length,
          rejected: emailsData.filter((e: any) => e.status === 'REJECTED').length,
        };
        setStats(s);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchStats();
  }, [token]);

  const statCards = [
    { title: 'Total Sent', value: stats?.total || 0, icon: Mail, color: 'bg-indigo-500' },
    { title: 'Pending Approval', value: stats?.pending || 0, icon: Clock, color: 'bg-amber-500' },
    { title: 'Approved', value: stats?.approved || 0, icon: CheckCircle, color: 'bg-emerald-500' },
    { title: 'Rejected', value: stats?.rejected || 0, icon: XCircle, color: 'bg-rose-500' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="page-title">
            <h1 className="text-3xl font-bold text-[#1e293b] tracking-tight">Welcome, {user?.name}!</h1>
            <p className="text-[#64748b] mt-1">Track your email requests and generate new ones with AI.</p>
          </div>
          <Button 
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-lg px-5 h-10 font-semibold shadow-sm shadow-indigo-100"
            onClick={() => setIsComposeOpen(true)}
          >
            <Send className="w-4 h-4 mr-2" />
            New Email Request
          </Button>
        </header>

        {/* Mobile Stats Row (Visible only on mobile) */}
        <div className="flex md:hidden overflow-x-auto pb-4 gap-3 no-scrollbar scroll-smooth">
          {statCards.map((stat) => (
            <div key={stat.title} className="flex-shrink-0 bg-white border border-[#e2e8f0] px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm min-w-[120px]">
              <div className={`w-2 h-2 rounded-full ${stat.color}`}></div>
              <span className="text-[10px] font-bold text-[#64748b] whitespace-nowrap">{stat.title}:</span>
              <span className="text-sm font-bold text-[#1e293b]">{loading ? '..' : stat.value}</span>
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
                  <p className="text-4xl font-light text-[#1e293b] tracking-tight">
                    {loading ? '...' : stat.value}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8">
          <Card className="border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden">
            <CardHeader className="px-6 md:px-8 py-5 md:py-6 border-b border-[#e2e8f0] flex flex-row items-center justify-between bg-white">
              <CardTitle className="text-lg font-bold text-[#1e293b]">Recent Requests</CardTitle>
              <Link href="/employee/status" className="hidden md:block">
                <Button variant="ghost" size="sm" className="text-[#6366f1] hover:bg-[#eef2ff] font-semibold text-xs transition-colors">
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="hidden md:table-header-group">
                    <TableRow className="bg-[#fafafa] hover:bg-[#fafafa]">
                      <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Date</TableHead>
                      <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Subject</TableHead>
                      <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-12 text-[#64748b]">Loading activity...</TableCell></TableRow>
                    ) : emails.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-12 text-[#64748b]">No recent requests.</TableCell></TableRow>
                    ) : (
                      emails.slice(0, 5).map((email: any) => (
                        <TableRow key={email.id} className="hover:bg-slate-50/50 border-b border-[#e2e8f0] transition-colors cursor-pointer group">
                          {/* Desktop View Row */}
                          <TableCell className="hidden md:table-cell px-8 py-5">
                            <span className="text-sm font-semibold text-[#1e293b]">
                              {new Date(email.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell px-8 py-5">
                            <span className="text-sm text-[#64748b] italic">&quot;{email.subject}&quot;</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell px-8 py-5">
                            {email.status === 'PENDING' ? (
                              <span className="px-3 py-1 rounded-full bg-[#fffbeb] text-[#d97706] text-[10px] font-bold uppercase tracking-wider">Pending</span>
                            ) : email.status === 'APPROVED' ? (
                              <span className="px-3 py-1 rounded-full bg-[#f0fdf4] text-[#16a34a] text-[10px] font-bold uppercase tracking-wider">Approved</span>
                            ) : email.status === 'SENT' ? (
                              <span className="px-3 py-1 rounded-full bg-[#eef2ff] text-[#6366f1] text-[10px] font-bold uppercase tracking-wider">Sent</span>
                            ) : (
                              <span className="px-3 py-1 rounded-full bg-[#fef2f2] text-[#dc2626] text-[10px] font-bold uppercase tracking-wider">Rejected</span>
                            )}
                          </TableCell>

                          {/* Mobile View Item (Optimized List Style) */}
                          <TableCell className="md:hidden p-4" colSpan={3}>
                            <Link href="/employee/status" className="flex flex-col gap-1">
                              <span className="text-sm font-bold text-[#1e293b] truncate line-clamp-1">{email.subject}</span>
                              <span className="text-[10px] font-medium text-[#64748b]">
                                {new Date(email.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </span>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            {/* Mobile View All Button */}
            <div className="md:hidden p-4 bg-[#f8fafc] border-t border-[#e2e8f0]">
              <Link href="/employee/status">
                <Button className="w-full bg-white hover:bg-[#f1f5f9] text-[#6366f1] border border-[#e2e8f0] rounded-xl h-11 font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98]">
                  View All Requests
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
      {isComposeOpen && <ComposeModal onClose={() => setIsComposeOpen(false)} />}
    </DashboardLayout>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
