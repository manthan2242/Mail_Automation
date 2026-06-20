'use client';

import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Clock, CheckCircle, XCircle, Send, Sparkles, Briefcase, AlertCircle, Camera, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import ComposeModal from '@/components/dashboard/ComposeModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

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
  const [assignedData, setAssignedData] = useState<{ projects: any[]; targets: any[] }>({ projects: [], targets: [] });
  const [assignedLoading, setAssignedLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  
  // Camera States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<'in' | 'out' | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch emails for stats
        const emailsRes = await fetch('/api/employee/emails', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const emailsData = await emailsRes.json();
        const emailsArray = Array.isArray(emailsData) ? emailsData : [];
        setEmails(emailsArray);
        
        const s = {
          total: emailsArray.length,
          pending: emailsArray.filter((e: any) => e.status === 'PENDING').length,
          approved: emailsArray.filter((e: any) => e.status === 'APPROVED' || e.status === 'SENT').length,
          rejected: emailsArray.filter((e: any) => e.status === 'REJECTED').length,
        };
        setStats(s);

        // Fetch assigned projects and targets
        const assignedRes = await fetch('/api/employee/assigned-projects', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const assignedDataResult = await assignedRes.json();
        if (assignedDataResult && !assignedDataResult.error) {
          setAssignedData(assignedDataResult);
        }

        // Fetch attendance status
        const attendanceRes = await fetch('/api/employee/attendance', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const attendanceData = await attendanceRes.json();
        if (attendanceData && !attendanceData.error) {
          setActiveSession(attendanceData.activeSession);
          setRecentLogs(attendanceData.recentLogs || []);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
        setAssignedLoading(false);
      }
    };

    if (token) {
      fetchDashboardData();
    }
  }, [token]);



  const openCameraVerification = async (action: 'in' | 'out') => {
    setPendingAction(action);
    setIsCameraOpen(true);
    setCameraLoading(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      });
      setCameraStream(stream);
      // Wait for ref to attach
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("Camera access error:", err);
      toast.error("Could not access camera. Please allow camera permissions and ensure it's not in use.");
      setIsCameraOpen(false);
      setPendingAction(null);
    } finally {
      setCameraLoading(false);
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
    setPendingAction(null);
  };

  const handleCaptureAndToggle = async () => {
    if (!videoRef.current || !pendingAction || !token) return;
    
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        toast.error("Failed to capture verification image.");
        return;
      }
      
      // Draw frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Format current timestamp
      const now = new Date();
      const timeStr = now.toLocaleString([], {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      
      // Timestamp security overlay
      ctx.font = 'bold 18px monospace';
      const textWidth = ctx.measureText(timeStr).width;
      const padding = 10;
      const rectWidth = textWidth + padding * 2;
      const rectHeight = 32;
      
      const x = canvas.width - rectWidth - 15;
      const y = canvas.height - rectHeight - 15;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, rectWidth, rectHeight, 6);
      } else {
        ctx.rect(x, y, rectWidth, rectHeight);
      }
      ctx.fill();
      
      ctx.fillStyle = '#f97316'; // Security timestamp orange
      ctx.textBaseline = 'middle';
      ctx.fillText(timeStr, x + padding, y + rectHeight / 2);
      
      const base64Image = canvas.toDataURL('image/jpeg', 0.85);
      
      // Shut off camera
      closeCamera();
      
      toast.loading('Submitting verification...', { id: 'auth-loading' });
      
      const res = await fetch('/api/employee/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: pendingAction, image: base64Image }),
      });
      
      const data = await res.json();
      toast.dismiss('auth-loading');
      
      if (res.ok) {
        toast.success(data.message || `Successfully clocked ${pendingAction}`);
        // Fetch fresh attendance status
        const attendanceRes = await fetch('/api/employee/attendance', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const attendanceData = await attendanceRes.json();
        if (attendanceData && !attendanceData.error) {
          setActiveSession(attendanceData.activeSession);
          setRecentLogs(attendanceData.recentLogs || []);
        }
      } else {
        toast.error(data.error || 'Failed to update attendance');
      }
    } catch (err) {
      toast.dismiss('auth-loading');
      console.error(err);
      toast.error('Network error during verification');
    }
  };

  const handleClockToggle = async () => {
    if (!token) return;
    const action = activeSession ? 'out' : 'in';
    openCameraVerification(action);
  };

  const statCards = [
    { title: 'Total Sent', value: stats?.total || 0, icon: Mail, color: 'bg-indigo-500' },
    { title: 'Pending Approval', value: stats?.pending || 0, icon: Clock, color: 'bg-amber-500' },
    { title: 'Approved', value: stats?.approved || 0, icon: CheckCircle, color: 'bg-emerald-500' },
    { title: 'Rejected', value: stats?.rejected || 0, icon: XCircle, color: 'bg-rose-500' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 md:space-y-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="page-title">
            <h1 className="text-2xl md:text-3xl font-bold text-[#1e293b] tracking-tight">Welcome, {user?.name}!</h1>
            <p className="text-xs md:text-sm text-[#64748b] mt-1">Track your email requests and generate new ones with AI.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Clock Widget */}
            <div className="hidden md:flex items-center gap-3 bg-white border border-[#e2e8f0] px-4 py-1.5 rounded-xl shadow-sm h-10">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${activeSession ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                <span className="text-xs font-semibold text-[#1e293b]">
                  {activeSession ? 'Clocked In' : 'Clocked Out'}
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleClockToggle}
                className={cn(
                  "h-7 text-xs font-semibold rounded-lg px-3 text-white transition-all shadow-sm",
                  activeSession 
                    ? "bg-rose-500 hover:bg-rose-600 shadow-rose-100" 
                    : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100"
                )}
              >
                {activeSession ? 'Clock Out' : 'Clock In'}
              </Button>
            </div>

            <Button 
              className="hidden md:inline-flex bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-lg px-5 h-10 font-semibold shadow-sm shadow-indigo-100"
              onClick={() => setIsComposeOpen(true)}
            >
              <Send className="w-4 h-4 mr-2" />
              New Email Request
            </Button>
          </div>
        </header>

        {/* Mobile Stats Row (Visible only on mobile, no horizontal scrollbar) */}
        <div className="grid grid-cols-2 gap-2.5 md:hidden">
          {statCards.map((stat) => (
            <div key={stat.title} className="bg-white border border-[#e2e8f0] p-3 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm">
              <span className="text-[9px] font-bold text-[#64748b] uppercase tracking-wider line-clamp-1">
                {stat.title}
              </span>
              <span className="text-lg font-bold text-[#1e293b] mt-1">
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
                  <p className="text-4xl font-light text-[#1e293b] tracking-tight">
                    {loading ? '...' : stat.value}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 lg:row-span-2 order-2 lg:order-1">
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

          <div className="lg:col-span-1 order-1 lg:order-2">
            <Card className="border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden">
              <CardHeader className="px-6 py-5 border-b border-[#e2e8f0] flex flex-row items-center gap-2 bg-white">
                <Briefcase className="w-5 h-5 text-[#6366f1]" />
                <CardTitle className="text-lg font-bold text-[#1e293b]">Assigned Projects</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {assignedLoading ? (
                  <div className="text-center py-8 text-[#64748b]">Loading projects...</div>
                ) : assignedData.projects.length === 0 ? (
                  <div className="text-center py-8 text-[#64748b] flex flex-col items-center gap-2">
                    <AlertCircle className="w-8 h-8 text-[#94a3b8]" />
                    <p className="text-sm font-semibold text-[#1e293b]">No projects assigned</p>
                    <p className="text-xs text-[#94a3b8] text-center">Contact your administrator to get projects assigned.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {assignedData.projects.map((project) => {
                      const target = assignedData.targets.find((t: any) => t.projectId === project.id);
                      const percentage = target && target.mailCount > 0 
                        ? Math.min(100, Math.round((target.currentCount / target.mailCount) * 100))
                        : null;
                      const isCompleted = target ? (target.isCompleted || target.currentCount >= target.mailCount) : false;

                      return (
                        <div key={project.id} className="p-4 rounded-xl border border-[#e2e8f0] hover:border-[#cbd5e1] transition-all bg-[#f8fafc]/50">
                          <div className="flex justify-between items-start gap-2 mb-3">
                            <div>
                              <h4 className="text-sm font-semibold text-[#1e293b]">{project.name}</h4>
                              <p className="text-xs text-[#64748b]">{project.client?.name || 'Client'}</p>
                            </div>
                            {target ? (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                target.frequency === 'DAILY' ? 'bg-blue-50 text-blue-600' :
                                target.frequency === 'WEEKLY' ? 'bg-purple-50 text-purple-600' :
                                'bg-pink-50 text-pink-600'
                              }`}>
                                {target.frequency}
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-[#94a3b8] px-2 py-0.5 rounded bg-[#f1f5f9]">
                                No Target
                              </span>
                            )}
                          </div>

                          {target && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-[#64748b]">SLA Target Progress</span>
                                <span className="font-medium text-[#1e293b]">
                                  {target.currentCount} / {target.mailCount} mails
                                </span>
                              </div>
                              
                              {/* Progress bar */}
                              <div className="w-full bg-[#e2e8f0] rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-[#6366f1]'}`}
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>

                              <div className="flex justify-between items-center pt-1">
                                <span className="text-[10px] text-[#94a3b8]">
                                  {percentage}% completed
                                </span>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                  isCompleted ? 'text-emerald-600' : 'text-[#6366f1]'
                                }`}>
                                  {isCompleted ? 'Target Achieved' : 'In Progress'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 order-3 lg:order-3">
            <Card className="border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden">
              <CardHeader className="px-6 py-5 border-b border-[#e2e8f0] flex flex-row items-center gap-2 bg-white">
                <Clock className="w-5 h-5 text-[#6366f1]" />
                <CardTitle className="text-lg font-bold text-[#1e293b]">Recent Attendance</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {recentLogs.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#94a3b8]">No attendance history found.</div>
                ) : (
                  <div className="space-y-4 max-h-[260px] overflow-y-auto pr-1 no-scrollbar">
                    {recentLogs.map((log) => {
                      const isSessionActive = !log.clockOut;
                      return (
                        <div key={log.id} className="flex justify-between items-center text-xs border-b border-[#f1f5f9] pb-3 last:border-0 last:pb-0">
                          <div>
                            <p className="font-semibold text-[#1e293b]">{formatDate(log.clockIn)}</p>
                            <p className="text-[#64748b] mt-0.5">
                              {formatTime(log.clockIn)} - {log.clockOut ? formatTime(log.clockOut) : <span className="text-emerald-600 font-medium animate-pulse">Active Now</span>}
                            </p>
                          </div>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold",
                            isSessionActive ? "bg-emerald-50 text-emerald-600" : "bg-[#f1f5f9] text-[#64748b]"
                          )}>
                            {isSessionActive ? 'Active' : 'Completed'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      {isComposeOpen && <ComposeModal onClose={() => setIsComposeOpen(false)} />}

      {/* Mobile Clock Widget (Floating bottom left) */}
      <div className="md:hidden fixed bottom-[76px] left-4 z-40 flex items-center gap-2 bg-white border border-[#e2e8f0]/80 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${activeSession ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
          <span className="text-[10px] font-bold text-[#1e293b]">
            {activeSession ? 'In' : 'Out'}
          </span>
        </div>
        <Button
          size="sm"
          onClick={handleClockToggle}
          className={cn(
            "h-7 text-[10px] font-bold rounded-xl px-2.5 text-white transition-all shadow-sm active:scale-95",
            activeSession 
              ? "bg-rose-500 hover:bg-rose-600 shadow-rose-100" 
              : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100"
          )}
        >
          {activeSession ? 'Clock Out' : 'Clock In'}
        </Button>
      </div>

      {/* Mobile New Email Floating Button (Bottom Right) */}
      <Button
        onClick={() => setIsComposeOpen(true)}
        className="md:hidden fixed bottom-[76px] right-4 z-40 bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-2xl h-10 px-4 font-bold shadow-[0_8px_20px_-4px_rgba(99,102,241,0.6)] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
      >
        <Send className="w-4 h-4" />
        New Email
      </Button>

      {/* Camera Verification Modal */}
      <Dialog open={isCameraOpen} onOpenChange={(open) => { if (!open) closeCamera(); }}>
        <DialogContent className="sm:max-w-[500px] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
            <DialogTitle className="text-xl font-bold text-[#1e293b] flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#6366f1]" />
              Security Verification
            </DialogTitle>
            <p className="text-xs text-[#64748b] mt-1">
              Verify your physical presence. Only a live, real-time capture from your device's camera will be accepted.
            </p>
          </DialogHeader>
          <div className="p-8 space-y-6 flex flex-col items-center">
            <div className="relative w-full h-[320px] rounded-2xl overflow-hidden border border-[#e2e8f0] bg-slate-950 flex items-center justify-center group shadow-inner">
              {/* Webcam Video Stream */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              
              {/* CCTV Style Scanner Bar Overlay */}
              {cameraStream && (
                <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-[#6366f1]/30 rounded-2xl">
                  <motion.div
                    className="w-full h-[2px] bg-[#6366f1] opacity-75 shadow-[0_0_8px_#6366f1] absolute left-0"
                    animate={{ top: ['0%', '98%', '0%'] }}
                    transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                  />
                  <div className="absolute top-4 left-4 font-mono text-[10px] text-emerald-400 bg-black/50 px-2 py-1 rounded select-none flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                    LIVE FEED
                  </div>
                </div>
              )}

              {cameraLoading && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-white gap-3 rounded-2xl">
                  <Loader2 className="w-8 h-8 text-[#6366f1] animate-spin" />
                  <p className="text-xs font-semibold tracking-wide text-slate-300">Initializing Camera...</p>
                </div>
              )}
            </div>

            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                onClick={closeCamera}
                className="flex-1 rounded-xl py-6 font-semibold border-slate-200 hover:bg-slate-50 transition-colors text-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCaptureAndToggle}
                disabled={cameraLoading || !cameraStream}
                className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-xl py-6 font-bold shadow-sm shadow-indigo-100 flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Capture & {pendingAction === 'in' ? 'Clock In' : 'Clock Out'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

const formatTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};
