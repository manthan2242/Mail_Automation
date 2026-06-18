'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Clock, 
  Users, 
  UserCheck, 
  Camera, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface AttendanceSession {
  id: string;
  clockIn: string;
  clockOut: string | null;
  clockInImage: string | null;
  clockOutImage: string | null;
}

interface EmployeeAttendance {
  id: string;
  name: string;
  email: string;
  username: string;
  attendanceLogs: AttendanceSession[];
}

export default function AdminAttendancePage() {
  const [dailyLogDate, setDailyLogDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  
  const [employees, setEmployees] = useState<EmployeeAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  
  const { token } = useAuth();

  const fetchAttendanceLogs = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const start = new Date(`${dailyLogDate}T00:00:00`);
      const end = new Date(`${dailyLogDate}T23:59:59`);
      
      const res = await fetch(`/api/admin/employees/attendance?startDate=${start.toISOString()}&endDate=${end.toISOString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setEmployees(data);
      } else {
        toast.error(data.error || 'Failed to load daily attendance logs');
      }
    } catch (err) {
      toast.error('Failed to load daily attendance logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceLogs();
  }, [token, dailyLogDate]);

  const formatWorkingHours = (clockIn: string, clockOut: string | null) => {
    const start = new Date(clockIn);
    const end = clockOut ? new Date(clockOut) : new Date();
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return '0h 0m';
    const diffMins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hrs}h ${mins}m`;
  };

  const calculateTotalWorkingHours = (logs: AttendanceSession[]) => {
    let totalMs = 0;
    for (const log of logs) {
      const start = new Date(log.clockIn);
      const end = log.clockOut ? new Date(log.clockOut) : new Date();
      const diffMs = end.getTime() - start.getTime();
      if (diffMs > 0) {
        totalMs += diffMs;
      }
    }
    const diffMins = Math.floor(totalMs / 60000);
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hrs}h ${mins}m`;
  };

  const calculateAverageHours = (presentEmployees: EmployeeAttendance[]) => {
    if (presentEmployees.length === 0) return '0h 0m';
    let totalMs = 0;
    let count = 0;
    for (const emp of presentEmployees) {
      if (emp.attendanceLogs.length > 0) {
        count++;
        for (const log of emp.attendanceLogs) {
          const start = new Date(log.clockIn);
          const end = log.clockOut ? new Date(log.clockOut) : new Date();
          const diffMs = end.getTime() - start.getTime();
          if (diffMs > 0) totalMs += diffMs;
        }
      }
    }
    if (count === 0) return '0h 0m';
    const avgMs = Math.floor(totalMs / count);
    const diffMins = Math.floor(avgMs / 60000);
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hrs}h ${mins}m`;
  };

  // Stats Calculations
  const totalEmployeesCount = employees.length;
  const presentEmployees = employees.filter(e => e.attendanceLogs.length > 0);
  const presentCount = presentEmployees.length;
  const absentCount = totalEmployeesCount - presentCount;
  
  const activeSessionsCount = employees.filter(e => 
    e.attendanceLogs.some(log => log.clockOut === null)
  ).length;

  const averageWorkingHours = calculateAverageHours(presentEmployees);

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="page-title">
            <h1 className="text-3xl font-bold text-[#1e293b] tracking-tight">Attendance Log</h1>
            <p className="text-[#64748b] mt-1">Monitor daily presence, sessions, and live verification photos date-wise.</p>
          </div>
          <div className="header-actions flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-4 h-11 border border-[#e2e8f0] rounded-xl shadow-sm">
              <Calendar className="w-4 h-4 text-[#6366f1]" />
              <Input
                type="date"
                value={dailyLogDate}
                onChange={(e) => setDailyLogDate(e.target.value)}
                className="border-none shadow-none focus-visible:ring-0 p-0 text-sm font-semibold text-slate-800 w-36 bg-transparent"
              />
            </div>
            <Button variant="outline" onClick={fetchAttendanceLogs} className="bg-white border-[#e2e8f0] text-[#1e293b] rounded-xl px-4 h-11 font-semibold shadow-sm hover:bg-slate-50">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border border-[#e2e8f0] shadow-sm bg-white rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Present Members</CardTitle>
              <UserCheck className="w-5 h-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#1e293b]">{presentCount} <span className="text-sm font-normal text-slate-400">/ {totalEmployeesCount}</span></div>
              <p className="text-xs text-[#64748b] mt-1">Logged presence for today</p>
            </CardContent>
          </Card>
          <Card className="border border-[#e2e8f0] shadow-sm bg-white rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Absent Members</CardTitle>
              <AlertCircle className="w-5 h-5 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#1e293b]">{absentCount}</div>
              <p className="text-xs text-[#64748b] mt-1">No attendance logs found</p>
            </CardContent>
          </Card>
          <Card className="border border-[#e2e8f0] shadow-sm bg-white rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Active Clock-In</CardTitle>
              <Clock className="w-5 h-5 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600 animate-pulse">{activeSessionsCount}</div>
              <p className="text-xs text-[#64748b] mt-1">Employees currently clocked in</p>
            </CardContent>
          </Card>
          <Card className="border border-[#e2e8f0] shadow-sm bg-white rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Avg Working Hours</CardTitle>
              <Users className="w-5 h-5 text-[#6366f1]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#1e293b]">{averageWorkingHours}</div>
              <p className="text-xs text-[#64748b] mt-1">Average daily accumulated hours</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Logs List */}
        <Card className="border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#fafafa] hover:bg-[#fafafa]">
                  <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider w-[240px]">Team Member</TableHead>
                  <TableHead className="px-6 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider w-[120px]">Status</TableHead>
                  <TableHead className="px-6 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Clock-In & Clock-Out Sessions</TableHead>
                  <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider text-right w-[180px]">Total Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-16 text-[#64748b]"><RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />Loading daily logs...</TableCell></TableRow>
                ) : employees.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-16 text-[#64748b]">No employees registered in system.</TableCell></TableRow>
                ) : (
                  employees.map((employee) => {
                    const isPresent = employee.attendanceLogs.length > 0;
                    const isClockedIn = employee.attendanceLogs.some(l => l.clockOut === null);

                    return (
                      <TableRow key={employee.id} className="hover:bg-slate-50/50 border-b border-[#e2e8f0] transition-colors align-top">
                        <TableCell className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#eef2ff] text-[#6366f1] flex items-center justify-center text-xs font-bold">
                              {employee.name[0].toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-semibold text-[#1e293b] truncate">
                                {employee.name}
                              </span>
                              <span className="text-[10px] text-[#64748b] truncate">
                                @{employee.username}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-5">
                          {isClockedIn ? (
                            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold uppercase tracking-wider text-[9px] hover:bg-indigo-50 animate-pulse">
                              Clocked In
                            </Badge>
                          ) : isPresent ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold uppercase tracking-wider text-[9px] hover:bg-emerald-50">
                              Present
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-50 text-slate-400 border-slate-200 font-bold uppercase tracking-wider text-[9px] hover:bg-slate-50">
                              Absent
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-5">
                          {isPresent ? (
                            <div className="space-y-3.5">
                              {employee.attendanceLogs.map((log, index) => {
                                const inTime = new Date(log.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const outTime = log.clockOut ? new Date(log.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

                                return (
                                  <div key={log.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#334155] bg-slate-50/80 hover:bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-100/80 transition-colors">
                                    <div className="font-semibold text-slate-500">Session {index + 1}:</div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-medium text-slate-800">In: {inTime}</span>
                                      {log.clockInImage && (
                                        <button
                                          onClick={() => setPreviewImage({ src: log.clockInImage!, title: `${employee.name} - Clock In (Session ${index + 1})` })}
                                          className="p-1 hover:bg-indigo-50 hover:text-indigo-600 rounded border border-slate-200 bg-white transition-colors"
                                          title="View clock-in photo"
                                        >
                                          <Camera className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-medium text-slate-800">
                                        Out: {outTime ? outTime : <span className="text-indigo-600 font-bold animate-pulse">Active</span>}
                                      </span>
                                      {log.clockOutImage && (
                                        <button
                                          onClick={() => setPreviewImage({ src: log.clockOutImage!, title: `${employee.name} - Clock Out (Session ${index + 1})` })}
                                          className="p-1 hover:bg-indigo-50 hover:text-indigo-600 rounded border border-slate-200 bg-white transition-colors"
                                          title="View clock-out photo"
                                        >
                                          <Camera className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-medium ml-auto">
                                      Duration: <span className="font-semibold text-slate-700">{formatWorkingHours(log.clockIn, log.clockOut)}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 italic">No activity logged for this date.</div>
                          )}
                        </TableCell>
                        <TableCell className="px-8 py-5 text-right font-bold text-[#1e293b] text-sm">
                          {isPresent ? calculateTotalWorkingHours(employee.attendanceLogs) : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Image Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="sm:max-w-[500px] bg-white rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="px-6 py-4 bg-[#f8fafc] border-b border-[#e2e8f0]">
            <DialogTitle className="text-base font-bold text-[#1e293b]">{previewImage?.title}</DialogTitle>
          </DialogHeader>
          <div className="p-6 flex items-center justify-center bg-slate-900/5 min-h-[350px]">
            {previewImage && (
              <img 
                src={previewImage.src} 
                alt="Verification Photo" 
                className="max-h-[500px] w-auto max-w-full rounded-2xl object-contain shadow-md border-4 border-white"
              />
            )}
          </div>
          <div className="px-6 py-4 bg-[#f8fafc] border-t border-[#e2e8f0] flex justify-end">
            <Button onClick={() => setPreviewImage(null)} className="bg-[#1e293b] hover:bg-[#334155] text-white rounded-xl px-5 h-10 text-xs font-semibold">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
