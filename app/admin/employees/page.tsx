'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, UserPlus, Trash2, Edit, ShieldCheck, Mail as MailIcon, Settings, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

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
        toast.success('Employee created successfully');
        setIsAddOpen(false);
        setNewEmployee({ email: '', username: '', name: '' });
        fetchEmployees();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to create employee');
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(search.toLowerCase()) || 
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    e.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
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
        toast.success('Employee deleted');
        fetchEmployees();
      }
    } catch (error) {
      toast.error('Failed to delete employee');
    }
  };

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [availableConfigs, setAvailableConfigs] = useState<any[]>([]);
  const [currentAssignments, setCurrentAssignments] = useState<string[]>([]);
  
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
        toast.success('Employee updated successfully');
        setIsEditOpen(false);
        fetchEmployees();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to update employee');
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
      toast.error('Failed to update employee');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="page-title">
            <h1 className="text-3xl font-bold text-[#1e293b] tracking-tight">Employee Management</h1>
            <p className="text-[#64748b] mt-1">Manage your team members and their access.</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger
              render={
                <Button className="bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-lg px-5 h-10 font-semibold shadow-sm shadow-indigo-100">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Employee
                </Button>
              }
            />
            <DialogContent className="sm:max-w-[450px] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
              <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
                <DialogTitle className="text-xl font-bold text-[#1e293b]">Add New Employee</DialogTitle>
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
                  <p className="font-bold text-[#1e293b] mb-1 uppercase tracking-wider">Default Credentials:</p>
                  <p>Password: {newEmployee.username || '{username}'}@123</p>
                  <p className="mt-1 italic">Employee will be forced to change this on first login.</p>
                </div>
                <Button type="submit" className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-xl py-6 font-bold shadow-sm shadow-indigo-100">
                  Create Employee
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        <Card className="border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden">
          <div className="p-6 border-b border-[#e2e8f0] bg-[#fafafa]">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
              <Input 
                placeholder="Search employees..." 
                className="pl-10 bg-white border-[#e2e8f0] rounded-xl text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {/* Mobile Employee List (Visible only on mobile) */}
          <div className="block md:hidden">
            {loading ? (
              <div className="text-center py-12 text-[#64748b]">Loading employees...</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-12 text-[#64748b]">No employees found.</div>
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
                          <DialogTitle className="text-lg font-bold text-[#1e293b]">Employee Details</DialogTitle>
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
                    <TableCell colSpan={5} className="text-center py-12 text-[#64748b]">Loading employees...</TableCell>
                  </TableRow>
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-[#64748b]">No employees found.</TableCell>
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
                            title="Edit Employee"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-[#64748b] hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                            onClick={() => handleDelete(employee.id)}
                            title="Delete Employee"
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
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[450px] bg-white rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="px-8 py-6 bg-[#f8fafc] border-b border-[#e2e8f0]">
            <DialogTitle className="text-xl font-bold text-[#1e293b]">Edit Employee</DialogTitle>
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
            <Button type="submit" className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-xl py-6 font-bold shadow-sm shadow-indigo-100">
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

