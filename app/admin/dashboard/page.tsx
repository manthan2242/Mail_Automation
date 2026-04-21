'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Mail, Settings, CheckCircle, Clock, AlertCircle, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import ComposeModal from '@/components/dashboard/ComposeModal';

interface Stats {
  totalEmployees: number;
  totalEmails: number;
  pendingEmails: number;
  approvedEmails: number;
  rejectedEmails: number;
  smtpConfigs: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, emailsRes] = await Promise.all([
          fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/admin/emails', { headers: { Authorization: `Bearer ${token}` } })
        ]);
        const statsData = await statsRes.json();
        const emailsData = await emailsRes.json();
        setStats(statsData);
        setEmails(Array.isArray(emailsData) ? emailsData : []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchData();
  }, [token]);

  const statCards = [
    { title: 'Pending Approval', value: stats?.pendingEmails || 0, icon: Clock, color: 'text-amber-500' },
    { title: 'Total Emails Sent', value: stats?.totalEmails || 0, icon: Mail, color: 'text-indigo-500' },
    { title: 'Active Employees', value: stats?.totalEmployees || 0, icon: Users, color: 'text-blue-500' },
    { title: 'System Status', value: 'Online', icon: CheckCircle, color: 'text-emerald-500' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="page-title">
            <h1 className="text-3xl font-bold text-[#1e293b] tracking-tight">Admin Console</h1>
            <p className="text-[#64748b] mt-1">Welcome back! Here&apos;s an overview of your system.</p>
          </div>
          <div className="header-actions flex gap-3">
            <Button 
               onClick={() => setIsComposeOpen(true)}
               className="bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-lg px-5 h-10 font-semibold shadow-sm shadow-indigo-100"
            >
              <Mail className="w-4 h-4 mr-2" />
              Compose Email
            </Button>
            <Link href="/admin/api-keys">
              <Button variant="outline" className="bg-white border-[#e2e8f0] text-[#1e293b] rounded-lg px-5 h-10 font-semibold shadow-sm hover:bg-slate-50">
                Generate API Key
              </Button>
            </Link>
          </div>
        </header>

        {isComposeOpen && <ComposeModal onClose={() => setIsComposeOpen(false)} />}

        {/* Mobile Stats Row (Visible only on mobile) */}
        <div className="flex md:hidden overflow-x-auto pb-4 gap-3 no-scrollbar scroll-smooth">
          {statCards.map((stat) => (
            <div key={stat.title} className="flex-shrink-0 bg-white border border-[#e2e8f0] px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm min-w-[140px]">
              <div className={`w-2 h-2 rounded-full ${stat.title === 'System Status' ? 'bg-[#22c55e]' : 'bg-indigo-500'}`}></div>
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
          <Card className="lg:col-span-2 border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden">
            <CardHeader className="px-6 md:px-8 py-5 md:py-6 border-b border-[#e2e8f0] flex flex-row items-center justify-between bg-white">
              <CardTitle className="text-lg font-bold text-[#1e293b]">Recent Email Activity</CardTitle>
              <Link href="/admin/emails">
                <Button variant="ghost" size="sm" className="text-[#6366f1] hover:bg-[#eef2ff] font-semibold text-xs">
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#fafafa] hover:bg-[#fafafa]">
                      <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider text-xs md:text-[11px]">Employee</TableHead>
                      <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider text-xs md:text-[11px]">Subject</TableHead>
                      <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider text-xs md:text-[11px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-12 text-[#64748b]">Loading activity...</TableCell></TableRow>
                    ) : emails.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-12 text-[#64748b]">No recent activity.</TableCell></TableRow>
                    ) : (
                      emails.slice(0, 5).map((email: any) => (
                        <TableRow key={email.id} className="hover:bg-slate-50/50 border-b border-[#e2e8f0] transition-colors">
                          <TableCell className="px-4 md:px-8 py-4 md:py-5">
                            <div className="flex items-center gap-3">
                              <div className="hidden sm:flex w-8 h-8 rounded-full bg-[#e2e8f0] items-center justify-center text-[#64748b] text-[10px] font-bold">
                                {email.employee ? email.employee.name[0] : 'A'}
                              </div>
                              <span className="text-sm font-semibold text-[#1e293b]">
                                {email.employee ? email.employee.name : 'Admin'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 md:px-8 py-4 md:py-5">
                            <span className="text-sm text-[#64748b] italic truncate max-w-[120px] md:max-w-none block">&quot;{email.subject}&quot;</span>
                          </TableCell>
                          <TableCell className="px-4 md:px-8 py-4 md:py-5">
                            {email.status === 'PENDING' ? (
                              <span className="px-3 py-1 rounded-full bg-[#fffbeb] text-[#d97706] text-[10px] font-bold uppercase tracking-wider">Pending</span>
                            ) : email.status === 'APPROVED' ? (
                              <span className="px-3 py-1 rounded-full bg-[#f0fdf4] text-[#16a34a] text-[10px] font-bold uppercase tracking-wider">Approved</span>
                            ) : email.status === 'SENT' ? (
                              <span className="px-3 py-1 rounded-full bg-[#eef2ff] text-[#4f46e5] text-[10px] font-bold uppercase tracking-wider">Sent</span>
                            ) : (
                              <span className="px-3 py-1 rounded-full bg-[#fef2f2] text-[#dc2626] text-[10px] font-bold uppercase tracking-wider">Rejected</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* System Health Card (Hidden on mobile) */}
          <Card className="hidden lg:block border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden">
            <CardHeader className="px-8 py-6 border-b border-[#e2e8f0] bg-white">
              <CardTitle className="text-lg font-bold text-[#1e293b]">System Health</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-[#64748b]">
                  <span>SMTP Delivery Rate</span>
                  <span className="text-[#1e293b]">98.2%</span>
                </div>
                <div className="h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                  <div className="h-full bg-[#6366f1] w-[98.2%] rounded-full" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-[#64748b]">
                  <span>AI Response Accuracy</span>
                  <span className="text-[#1e293b]">94.5%</span>
                </div>
                <div className="h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                  <div className="h-full bg-[#6366f1] w-[94.5%] rounded-full" />
                </div>
              </div>
              
              <div className="pt-4">
                <div className="p-4 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white border border-[#e2e8f0] flex items-center justify-center shadow-sm">
                    <Sparkles className="w-5 h-5 text-[#6366f1]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#1e293b]">AI Engine v2.4</p>
                    <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-semibold">Running Optimal</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
