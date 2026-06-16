'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, UserPlus, Trash2, Edit, ShieldCheck, Mail as MailIcon, Settings, CheckCircle, Briefcase, Clock, Camera, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Employee {
  id: string;
  email: string;
  username: string;
  name: string;
  createdAt: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ email: '', username: '', name: '' });
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState({ email: '', username: '', name: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { token } = useAuth();
  
  const handleSendOTP = async (employeeId: string) => {
    try {
      const res = await fetch('/api/admin/employees/send-otp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ employeeId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('OTP sent successfully');
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to send OTP');
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/admin/employees', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setEmployees(data);
    } catch (error) {
      toast.error('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchEmployees();
  }, [token]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newEmployee),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Team Member created successfully');
        setIsAddOpen(false);
        setNewEmployee({ email: '', username: '', name: '' });
        fetchEmployees();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to create team member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(search.toLowerCase()) || 
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    e.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this team member?')) return;
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast.success('Team Member deleted');
        fetchEmployees();
      }
    } catch (error) {
      toast.error('Failed to delete team member');
    }
  };

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [availableConfigs, setAvailableConfigs] = useState<any[]>([]);
  const [isProjectAssignOpen, setIsProjectAssignOpen] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [currentProjectAssignments, setCurrentProjectAssignments] = useState<string[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [currentAssignments, setCurrentAssignments] = useState<string[]>([]);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // Verification & Daily Attendance Log States
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  const [isDailyLogOpen, setIsDailyLogOpen] = useState(false);
  const [dailyLogDate, setDailyLogDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);

  const fetchDailyLogs = async (dateStr: string) => {
    if (!token) return;
    setDailyLoading(true);
    try {
      const localDate = new Date(dateStr);
      const start = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 0, 0, 0, 0);
      const end = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 23, 59, 59, 999);
      
      const res = await fetch(`/api/admin/employees/attendance?startDate=${start.toISOString()}&endDate=${end.toISOString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setDailyLogs(data);
      } else {
        toast.error(data.error || 'Failed to load daily attendance logs');
      }
    } catch (err) {
      toast.error('Failed to load daily attendance logs');
    } finally {
      setDailyLoading(false);
    }
  };

  useEffect(() => {
    if (isDailyLogOpen && token && dailyLogDate) {
      fetchDailyLogs(dailyLogDate);
    }
  }, [isDailyLogOpen, dailyLogDate, token]);

  const [isGlobalProjectAssignOpen, setIsGlobalProjectAssignOpen] = useState(false);
  const [globalSelectedEmployeeId, setGlobalSelectedEmployeeId] = useState<string>('');

  const handleOpenAttendance = async (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsAttendanceOpen(true);
    setAttendanceLoading(true);
    try {
      const res = await fetch(`/api/admin/employees/attendance?employeeId=${employee.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAttendanceLogs(data);
      } else {
        toast.error(data.error || 'Failed to load attendance logs');
      }
    } catch (err) {
      toast.error('Failed to load attendance logs');
    } finally {
      setAttendanceLoading(false);
    }
  };
  
  const handleOpenEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setEditForm({
      email: employee.email,
      username: employee.username,
      name: employee.name
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          id: editingEmployee.id, 
          ...editForm 
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Team member updated successfully');
        setIsEditOpen(false);
        fetchEmployees();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to update team member');
    }
  };

  const handleOpenAssign = async (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsAssignOpen(true);
    try {
      const [configsRes, assignmentsRes] = await Promise.all([
        fetch('/api/admin/email-configs', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/employees/assignments?employeeId=${employee.id}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const configsData = await configsRes.json();
      const assignmentsData = await assignmentsRes.json();
      setAvailableConfigs(configsData);
      setCurrentAssignments(assignmentsData.map((a: any) => a.emailAccountId));
    } catch (err) {
      toast.error('Failed to load assignments');
    }
  };

  const handleOpenProjectAssign = async (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsProjectAssignOpen(true);
    try {
      const res = await fetch(`/api/admin/employees/project-assignments?employeeId=${employee.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setAvailableProjects(data.allProjects || []);
      setCurrentProjectAssignments(data.currentAssignments || []);
    } catch (err) {
      toast.error('Failed to load project assignments');
    }
  };

  const handleToggleProjectAssignment = async (projectId: string) => {
    const isAssigned = currentProjectAssignments.includes(projectId);
    try {
      const res = await fetch('/api/admin/assign-project', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          employeeId: selectedEmployee?.id, 
          projectId
        }),
      });
      if (res.ok) {
        toast.success(isAssigned ? 'Project assignment removed' : 'Project assigned successfully');
        setCurrentProjectAssignments(prev => 
          isAssigned ? prev.filter(id => id !== projectId) : [...prev, projectId]
        );
      }
    } catch (err) {
      toast.error('Failed to update project assignment');
    }
  };

  const handleGlobalEmployeeChange = async (employeeId: string | null) => {
    const safeId = employeeId || '';
    setGlobalSelectedEmployeeId(safeId);
    if (!safeId) {
      setAvailableProjects([]);
      setCurrentProjectAssignments([]);
      setSelectedEmployee(null);
      return;
    }
    const employee = employees.find(e => e.id === safeId);
    if (employee) {
      setSelectedEmployee(employee);
    }
    try {
      const res = await fetch(`/api/admin/employees/project-assignments?employeeId=${safeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setAvailableProjects(data.allProjects || []);
      setCurrentProjectAssignments(data.currentAssignments || []);
    } catch (err) {
      toast.error('Failed to load project assignments');
    }
  };

  const handleCloseGlobalAssign = () => {
    setIsGlobalProjectAssignOpen(false);
    setGlobalSelectedEmployeeId('');
    setAvailableProjects([]);
    setCurrentProjectAssignments([]);
  };

  const handleToggleAssignment = async (configId: string) => {
    const isAssigned = currentAssignments.includes(configId);
    try {
      const res = await fetch('/api/admin/assign-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          employeeId: selectedEmployee?.id, 
          emailAccountId: configId
        }),
      });
      if (res.ok) {
        toast.success(isAssigned ? 'Assignment removed' : 'Email assigned');
        setCurrentAssignments(prev => 
          isAssigned ? prev.filter(id => id !== configId) : [...prev, configId]
        );
      }
    } catch (err) {
      toast.error('Failed to update assignment');
    }
  };

  const handleToggle2FA = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id, twoFactorEnabled: !currentStatus }),
      });
      if (res.ok) {
        toast.success('Security settings updated');
        fetchEmployees();
      }
    } catch (error) {
      toast.error('Failed to update Team member');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="page-title">
            <h1 className="text-3xl font-bold text-[#1e293b] tracking-tight">Team Member Management</h1>
            <p className="text-[#64748b] mt-1">Manage your team members and their access.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={() => setIsDailyLogOpen(true)}
              className="bg-white hover:bg-slate-50 text-[#1e293b] border border-[#e2e8f0] rounded-lg px-5 h-10 font-semibold shadow-sm"
            >
              <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
              Attendance Log
            </Button>

            <Button 
              onClick={() => setIsGlobalProjectAssignOpen(true)}
              className="bg-white hover:bg-slate-50 text-[#1e293b] border border-[#e2e8f0] rounded-lg px-5 h-10 font-semibold shadow-sm"
            >
              <Briefcase className="w-4 h-4 mr-2 text-indigo-500" />
              Assign Project
            </Button>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger
                render={
                  <Button className="bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-lg px-5 h-10 font-semibold shadow-sm shadow-indigo-100">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Team Member
                  </Button>
                }
              />
            <DialogContent className="sm:max-w-[450px] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
              <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
                <DialogTitle className="text-xl font-bold text-[#1e293b]">Add New Team Member</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="p-8 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Full Name</Label>
                  <Input 
                    id="name" 
                    placeholder="John Doe" 
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                    className="rounded-xl border-[#e2e8f0] focus:ring-[#6366f1]"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Username</Label>
                  <Input 
                    id="username" 
                    placeholder="johndoe" 
                    value={newEmployee.username}
                    onChange={(e) => setNewEmployee({...newEmployee, username: e.target.value})}
                    className="rounded-xl border-[#e2e8f0] focus:ring-[#6366f1]"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="john@example.com" 
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                    className="rounded-xl border-[#e2e8f0] focus:ring-[#6366f1]"
                    required 
                  />
                </div>
                <div className="p-4 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] text-[11px] text-[#64748b]">
                  <p className="font-bold text-[#1e293b] mb-1 uppercase tracking-wider">Security:</p>
                  <p>A random password will be automatically generated and sent to the team member's email address upon creation.</p>
                  <p className="mt-1 italic">Team Member will be forced to change this on first login.</p>
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-xl py-6 font-bold shadow-sm shadow-indigo-100">
                  {isSubmitting ? 'Creating...' : 'Create Team Member'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </header>

        <Card className="border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden">
          <div className="p-6 border-b border-[#e2e8f0] bg-[#fafafa]">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
              <Input 
                placeholder="Search team members..." 
                className="pl-10 bg-white border-[#e2e8f0] rounded-xl text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {/* Mobile Team Member List (Visible only on mobile) */}
          <div className="block md:hidden">
            {loading ? (
              <div className="text-center py-12 text-[#64748b]">Loading Team Members...</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-12 text-[#64748b]">No Team Members found.</div>
            ) : (
              <div className="divide-y divide-[#e2e8f0]">
                {filteredEmployees.map((employee) => (
                  <div key={employee.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#f1f5f9] flex items-center justify-center text-[#6366f1] font-bold">
                        {employee.name[0]}
                      </div>
                      <span className="font-semibold text-[#1e293b]">{employee.name}</span>
                    </div>
                    
                    <Dialog>
                      <DialogTrigger
                        render={
                          <Button variant="ghost" size="icon" className="text-[#6366f1] bg-indigo-50 rounded-full">
                            <Plus className="w-4 h-4" />
                          </Button>
                        }
                      />
                      <DialogContent className="w-[90vw] max-w-[400px] rounded-[24px] p-0 overflow-hidden border-none shadow-2xl">
                        <DialogHeader className="px-6 py-4 bg-[#f8fafc] border-b border-[#e2e8f0]">
                          <DialogTitle className="text-lg font-bold text-[#1e293b]">Team Member Details</DialogTitle>
                        </DialogHeader>
                        <div className="p-6 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Name</p>
                              <p className="text-sm font-semibold text-[#1e293b]">{employee.name}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Username</p>
                              <p className="text-sm text-[#64748b]">@{employee.username}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Email</p>
                            <p className="text-sm text-[#64748b]">{employee.email}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Joined</p>
                            <p className="text-sm text-[#64748b]">{new Date(employee.createdAt).toLocaleDateString()}</p>
                          </div>
                          
                          <div className="pt-4 flex flex-wrap gap-2 border-t border-[#e2e8f0]">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className={cn(
                                "flex-1 rounded-lg text-xs font-bold",
                                (employee as any).twoFactorEnabled ? "text-emerald-600 border-emerald-100 bg-emerald-50" : "text-[#64748b]"
                              )}
                              onClick={() => handleToggle2FA(employee.id, (employee as any).twoFactorEnabled)}
                            >
                              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                              2FA {(employee as any).twoFactorEnabled ? 'On' : 'Off'}
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 rounded-lg text-xs font-bold text-indigo-600 border-indigo-100 bg-indigo-50"
                              onClick={() => handleOpenAssign(employee)}
                            >
                              <Settings className="w-3.5 h-3.5 mr-1.5" />
                              Assign
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 rounded-lg text-xs font-bold text-blue-600 border-blue-100 bg-blue-50"
                              onClick={() => handleSendOTP(employee.id)}
                            >
                              <MailIcon className="w-3.5 h-3.5 mr-1.5" />
                              OTP
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 rounded-lg text-xs font-bold text-amber-600 border-amber-100 bg-amber-50"
                              onClick={() => handleOpenEdit(employee)}
                            >
                              <Edit className="w-3.5 h-3.5 mr-1.5" />
                              Edit
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              className="flex-1 rounded-lg text-xs font-bold"
                              onClick={() => handleDelete(employee.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Employee Table (Hidden on mobile) */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#fafafa] hover:bg-[#fafafa]">
                  <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Name</TableHead>
                  <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Username</TableHead>
                  <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Email</TableHead>
                  <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Joined Date</TableHead>
                  <TableHead className="px-8 py-4 text-[11px] font-bold text-[#64748b] uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-[#64748b]">Loading Team Members...</TableCell>
                  </TableRow>
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-[#64748b]">No Team Members found.</TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((employee) => (
                    <TableRow key={employee.id} className="hover:bg-slate-50/50 border-b border-[#e2e8f0] transition-colors">
                      <TableCell className="px-8 py-5 font-semibold text-[#1e293b]">{employee.name}</TableCell>
                      <TableCell className="px-8 py-5 text-[#64748b] text-sm">@{employee.username}</TableCell>
                      <TableCell className="px-8 py-5 text-[#64748b] text-sm">{employee.email}</TableCell>
                      <TableCell className="px-8 py-5 text-[#64748b] text-xs">{new Date(employee.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="px-8 py-5 text-right">
                        <div className="flex justify-end space-x-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn(
                              "rounded-lg transition-colors",
                              (employee as any).twoFactorEnabled 
                                ? "text-[#22c55e] hover:bg-[#f0fdf4]" 
                                : "text-[#64748b] hover:bg-[#f8fafc]"
                            )}
                            onClick={() => handleToggle2FA(employee.id, (employee as any).twoFactorEnabled)}
                            title={(employee as any).twoFactorEnabled ? "2FA Enabled" : "2FA Disabled"}
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-[#64748b] hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            onClick={() => handleOpenAssign(employee)}
                            title="Assign Email Identities"
                          >
                            <Settings className="w-4 h-4 text-indigo-500" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-[#64748b] hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            onClick={() => handleOpenProjectAssign(employee)}
                            title="Assign Projects"
                          >
                            <Briefcase className="w-4 h-4 text-indigo-500" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-[#64748b] hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                            onClick={() => handleOpenAttendance(employee)}
                            title="View Attendance Logs"
                          >
                            <Clock className="w-4 h-4 text-amber-500" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-[#64748b] hover:text-[#6366f1] hover:bg-[#eef2ff] rounded-lg"
                            onClick={() => handleSendOTP(employee.id)}
                            title="Send Login OTP"
                          >
                            <MailIcon className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-[#64748b] hover:text-[#6366f1] hover:bg-[#eef2ff] rounded-lg"
                            onClick={() => handleOpenEdit(employee)}
                            title="Edit Team Member"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-[#64748b] hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                            onClick={() => handleDelete(employee.id)}
                            title="Delete Team Member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
            <DialogTitle className="text-xl font-bold text-[#1e293b]">Email ID Assignments</DialogTitle>
            <p className="text-sm text-[#64748b]">Assign email identities to {selectedEmployee?.name}</p>
          </DialogHeader>
          <div className="p-8 space-y-4">
            {availableConfigs.length === 0 ? (
              <p className="text-center py-4 text-[#64748b]">No email identities configured.</p>
            ) : (
              <div className="space-y-3">
                {availableConfigs.map((config) => (
                  <div 
                    key={config.id} 
                    className={cn(
                      "p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between",
                      currentAssignments.includes(config.id) 
                        ? "border-[#6366f1] bg-[#eef2ff] shadow-sm" 
                        : "border-[#e2e8f0] hover:border-[#cbd5e1] bg-white"
                    )}
                    onClick={() => handleToggleAssignment(config.id)}
                  >
                    <div>
                      <p className="text-sm font-bold text-[#1e293b]">{config.email}</p>
                      <p className="text-[10px] text-[#64748b] uppercase tracking-wider">{config.host}</p>
                    </div>
                    {currentAssignments.includes(config.id) && (
                      <div className="w-5 h-5 rounded-full bg-[#6366f1] flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Button onClick={() => setIsAssignOpen(false)} className="w-full bg-[#1e293b] text-white rounded-xl py-6 mt-4">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isProjectAssignOpen} onOpenChange={setIsProjectAssignOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
            <DialogTitle className="text-xl font-bold text-[#1e293b]">Project Assignments</DialogTitle>
            <p className="text-sm text-[#64748b]">Assign client projects to {selectedEmployee?.name}</p>
          </DialogHeader>
          <div className="p-8 space-y-4">
            {availableProjects.length === 0 ? (
              <p className="text-center py-4 text-[#64748b]">No projects configured.</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {availableProjects.map((project) => (
                  <div 
                    key={project.id} 
                    className={cn(
                      "p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between",
                      currentProjectAssignments.includes(project.id) 
                        ? "border-[#6366f1] bg-[#eef2ff] shadow-sm" 
                        : "border-[#e2e8f0] hover:border-[#cbd5e1] bg-white"
                    )}
                    onClick={() => handleToggleProjectAssignment(project.id)}
                  >
                    <div>
                      <p className="text-sm font-bold text-[#1e293b]">{project.name}</p>
                      <p className="text-[10px] text-[#64748b] uppercase tracking-wider">Client: {project.client?.name}</p>
                    </div>
                    {currentProjectAssignments.includes(project.id) && (
                      <div className="w-5 h-5 rounded-full bg-[#6366f1] flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Button onClick={() => setIsProjectAssignOpen(false)} className="w-full bg-[#1e293b] text-white rounded-xl py-6 mt-4">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAttendanceOpen} onOpenChange={setIsAttendanceOpen}>
        <DialogContent className="sm:max-w-[550px] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
            <DialogTitle className="text-xl font-bold text-[#1e293b]">Attendance History</DialogTitle>
            <p className="text-sm text-[#64748b]">View clocking activities for {selectedEmployee?.name}</p>
          </DialogHeader>
          <div className="p-8 space-y-4">
            {attendanceLoading ? (
              <p className="text-center py-8 text-[#64748b]">Loading attendance logs...</p>
            ) : attendanceLogs.length === 0 ? (
              <p className="text-center py-8 text-[#64748b]">No attendance records found for this user.</p>
            ) : (
              <div className="max-h-[350px] overflow-y-auto pr-1">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#fafafa] hover:bg-[#fafafa]">
                      <TableHead className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Date</TableHead>
                      <TableHead className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Clock In</TableHead>
                      <TableHead className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Clock Out</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceLogs.map((log) => {
                      const clockInDate = new Date(log.clockIn);
                      const clockOutDate = log.clockOut ? new Date(log.clockOut) : null;
                      
                      return (
                        <TableRow key={log.id} className="hover:bg-slate-50/50 border-b border-[#e2e8f0]">
                          <TableCell className="px-4 py-3 text-xs font-semibold text-[#1e293b]">
                            {clockInDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-[#64748b]">
                            <div className="flex items-center gap-2">
                              <span>{clockInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {log.clockInImage && (
                                <button
                                  onClick={() => setPreviewImage({ src: log.clockInImage, title: `${selectedEmployee?.name} - Clock In Photo` })}
                                  className="p-1 hover:bg-slate-100 hover:text-[#6366f1] rounded border border-transparent hover:border-slate-200 transition-colors"
                                  title="View Clock In Photo"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-[#64748b]">
                            <div className="flex items-center gap-2">
                              <span>
                                {clockOutDate 
                                  ? clockOutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : <span className="text-emerald-600 font-bold animate-pulse">Active Session</span>
                                }
                              </span>
                              {log.clockOutImage && (
                                <button
                                  onClick={() => setPreviewImage({ src: log.clockOutImage, title: `${selectedEmployee?.name} - Clock Out Photo` })}
                                  className="p-1 hover:bg-slate-100 hover:text-[#6366f1] rounded border border-transparent hover:border-slate-200 transition-colors"
                                  title="View Clock Out Photo"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <Button onClick={() => setIsAttendanceOpen(false)} className="w-full bg-[#1e293b] text-white rounded-xl py-6 mt-4">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[450px] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
            <DialogTitle className="text-xl font-bold text-[#1e293b]">Edit Team Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="p-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Full Name</Label>
              <Input 
                id="edit-name" 
                placeholder="John Doe" 
                value={editForm.name}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                className="rounded-xl border-[#e2e8f0] focus:ring-[#6366f1]"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Username</Label>
              <Input 
                id="edit-username" 
                placeholder="johndoe" 
                value={editForm.username}
                onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                className="rounded-xl border-[#e2e8f0] focus:ring-[#6366f1]"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Email Address</Label>
              <Input 
                id="edit-email" 
                type="email" 
                placeholder="john@example.com" 
                value={editForm.email}
                onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                className="rounded-xl border-[#e2e8f0] focus:ring-[#6366f1]"
                required 
              />
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-xl py-6 font-bold shadow-sm shadow-indigo-100">
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isGlobalProjectAssignOpen} onOpenChange={(open) => {
        if (!open) handleCloseGlobalAssign();
        else setIsGlobalProjectAssignOpen(true);
      }}>
        <DialogContent className="sm:max-w-[500px] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
            <DialogTitle className="text-xl font-bold text-[#1e293b]">Assign Client Projects</DialogTitle>
            <p className="text-sm text-[#64748b]">Select a team member and configure their client project assignments.</p>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Select Team Member</Label>
              <Select value={globalSelectedEmployeeId} onValueChange={handleGlobalEmployeeChange}>
                <SelectTrigger className="border-slate-200 rounded-xl bg-white h-11">
                  <SelectValue placeholder="Choose a team member...">
                    {employees.find(emp => emp.id === globalSelectedEmployeeId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 shadow-lg z-[210]">
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} (@{emp.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {globalSelectedEmployeeId && (
              <div className="space-y-3 pt-2">
                <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Assign Projects</Label>
                {availableProjects.length === 0 ? (
                  <p className="text-center py-4 text-[#64748b] text-xs">No projects configured in client directory.</p>
                ) : (
                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                    {availableProjects.map((project) => (
                      <div 
                        key={project.id} 
                        className={cn(
                          "p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs",
                          currentProjectAssignments.includes(project.id) 
                            ? "border-[#6366f1] bg-[#eef2ff] shadow-sm font-semibold" 
                            : "border-[#e2e8f0] hover:border-[#cbd5e1] bg-white text-slate-600"
                        )}
                        onClick={() => handleToggleProjectAssignment(project.id)}
                      >
                        <div>
                          <p className="font-bold text-[#1e293b] text-sm">{project.name}</p>
                          <p className="text-[10px] text-[#64748b] uppercase tracking-wider mt-0.5">Client: {project.client?.name}</p>
                        </div>
                        {currentProjectAssignments.includes(project.id) && (
                          <div className="w-5 h-5 rounded-full bg-[#6366f1] flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button onClick={handleCloseGlobalAssign} className="w-full bg-[#1e293b] text-white rounded-xl py-6 mt-4">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Daily Attendance Log Modal */}
      <Dialog open={isDailyLogOpen} onOpenChange={setIsDailyLogOpen}>
        <DialogContent className="sm:max-w-[700px] w-[95vw] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <DialogTitle className="text-xl font-bold text-[#1e293b]">Daily Attendance Log</DialogTitle>
                <p className="text-xs text-[#64748b] mt-1">Select a date to view presence status and live verification photos.</p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center">
                <Calendar className="w-4 h-4 text-[#6366f1]" />
                <Input
                  type="date"
                  value={dailyLogDate}
                  onChange={(e) => setDailyLogDate(e.target.value)}
                  className="w-36 rounded-lg border-[#e2e8f0] text-xs h-9 bg-white"
                />
              </div>
            </div>
          </DialogHeader>
          <div className="p-8 space-y-4">
            {dailyLoading ? (
              <p className="text-center py-12 text-[#64748b]">Loading team logs...</p>
            ) : dailyLogs.length === 0 ? (
              <p className="text-center py-12 text-[#64748b]">No employees found.</p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto pr-1">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#fafafa] hover:bg-[#fafafa]">
                      <TableHead className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Team Member</TableHead>
                      <TableHead className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Status</TableHead>
                      <TableHead className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Clock In</TableHead>
                      <TableHead className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Clock Out</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyLogs.map((employee) => {
                      const log = employee.attendanceLogs?.[0]; // Single log per employee per day
                      const isPresent = !!log;
                      
                      const clockInDate = log ? new Date(log.clockIn) : null;
                      const clockOutDate = log?.clockOut ? new Date(log.clockOut) : null;

                      return (
                        <TableRow key={employee.id} className="hover:bg-slate-50/50 border-b border-[#e2e8f0]">
                          <TableCell className="px-4 py-3 text-xs">
                            <div>
                              <p className="font-semibold text-[#1e293b]">{employee.name}</p>
                              <p className="text-[10px] text-[#64748b]">@{employee.username}</p>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs">
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              isPresent ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                            )}>
                              {isPresent ? 'Present' : 'Absent'}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-[#64748b]">
                            {clockInDate ? (
                              <div className="flex items-center gap-2">
                                <span>{clockInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {log.clockInImage && (
                                  <button
                                    onClick={() => setPreviewImage({ src: log.clockInImage, title: `${employee.name} - Clock In Photo` })}
                                    className="p-1 hover:bg-slate-100 hover:text-[#6366f1] rounded border border-transparent hover:border-slate-200 transition-colors"
                                    title="View Clock In Photo"
                                  >
                                    <Camera className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span>-</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-[#64748b]">
                            {isPresent ? (
                              clockOutDate ? (
                                <div className="flex items-center gap-2">
                                  <span>{clockOutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  {log.clockOutImage && (
                                    <button
                                      onClick={() => setPreviewImage({ src: log.clockOutImage, title: `${employee.name} - Clock Out Photo` })}
                                      className="p-1 hover:bg-slate-100 hover:text-[#6366f1] rounded border border-transparent hover:border-slate-200 transition-colors"
                                      title="View Clock Out Photo"
                                    >
                                      <Camera className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-emerald-600 font-bold animate-pulse">Active Session</span>
                              )
                            ) : (
                              <span>-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <Button onClick={() => setIsDailyLogOpen(false)} className="w-full bg-[#1e293b] text-white rounded-xl py-6 mt-4">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={(open) => { if (!open) setPreviewImage(null); }}>
        <DialogContent className="sm:max-w-[480px] w-[90vw] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden z-[250]">
          <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
            <DialogTitle className="text-lg font-bold text-[#1e293b]">{previewImage?.title}</DialogTitle>
          </DialogHeader>
          <div className="p-8 flex flex-col items-center">
            {previewImage && (
              <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={previewImage.src} 
                  alt="Verification" 
                  className="w-full h-auto object-contain max-h-[360px]"
                />
              </div>
            )}
            <Button onClick={() => setPreviewImage(null)} className="w-full bg-[#1e293b] text-white rounded-xl py-6 mt-6 font-semibold">
              Close Preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

