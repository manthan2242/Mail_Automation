'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Users, 
  Mail, 
  Key, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Send
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarItemProps {
  href: string;
  icon: any;
  label: string;
  active: boolean;
  onClick?: () => void;
}

const SidebarItem = ({ href, icon: Icon, label, active, onClick }: SidebarItemProps) => (
  <Link href={href} onClick={onClick}>
    <div className={cn(
      "flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group",
      active 
        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    )}>
      <Icon className={cn("w-5 h-5", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
      <span className="font-medium">{label}</span>
    </div>
  </Link>
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const adminItems = [
    { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/admin/mail-tool', icon: Send, label: 'Mail Writer' },
    { href: '/admin/employees', icon: Users, label: 'Employees' },
    { href: '/admin/emails', icon: Mail, label: 'Email Monitoring' },
    { href: '/admin/email-configs', icon: Settings, label: 'SMTP Config' },
    { href: '/admin/api-keys', icon: Key, label: 'API Keys' },
  ];

  const employeeItems = [
    { href: '/employee/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/employee/generate', icon: Send, label: 'Generate Email' },
    { href: '/employee/status', icon: Clock, label: 'Status Tracking' },
  ];

  const items = user?.role === 'admin' ? adminItems : employeeItems;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[240px] bg-white border-r border-[#e2e8f0] py-6 space-y-8">
        <div className="px-6 mb-2">
          <div className="flex items-center gap-2 text-[#6366f1] font-extrabold text-xl tracking-tight">
            <div className="w-8 h-8 bg-[#6366f1] rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white text-sm">M</span>
            </div>
            Mail Automation
          </div>
        </div>

        <nav className="flex-1">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all duration-200 border-r-3",
                  active 
                    ? "bg-[#eef2ff] text-[#6366f1] border-[#6366f1]" 
                    : "text-[#64748b] hover:text-[#1e293b] border-transparent"
                )}>
                  <item.icon className={cn("w-5 h-5", active ? "text-[#6366f1]" : "text-[#64748b]")} />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="px-6 pt-6 border-t border-[#e2e8f0]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-[#e2e8f0] flex items-center justify-center text-[#64748b] text-xs font-bold">
              {user?.name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#1e293b] truncate">{user?.name}</p>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-semibold">{user?.role}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-[#64748b] hover:text-red-600 hover:bg-red-50 rounded-lg h-9 px-2"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span className="text-xs font-semibold">Logout</span>
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-white border-b border-[#e2e8f0] p-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2 text-[#6366f1] font-extrabold text-lg">
            <div className="w-6 h-6 bg-[#6366f1] rounded-md flex items-center justify-center">
              <span className="text-white text-[10px]">M</span>
            </div>
            Mail Automation
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="w-6 h-6 text-[#64748b]" />
          </Button>
        </header>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
              />
              <motion.aside 
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 left-0 w-[240px] bg-white z-50 py-6 flex flex-col lg:hidden shadow-2xl"
              >
                <div className="flex items-center justify-between px-6 mb-8">
                  <div className="flex items-center gap-2 text-[#6366f1] font-extrabold text-xl">
                    <div className="w-8 h-8 bg-[#6366f1] rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">M</span>
                    </div>
                    Mail Automation
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                    <X className="w-6 h-6 text-[#64748b]" />
                  </Button>
                </div>

                <nav className="flex-1">
                  {items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
                        <div className={cn(
                          "flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all duration-200 border-r-3",
                          active 
                            ? "bg-[#eef2ff] text-[#6366f1] border-[#6366f1]" 
                            : "text-[#64748b] hover:text-[#1e293b] border-transparent"
                        )}>
                          <item.icon className={cn("w-5 h-5", active ? "text-[#6366f1]" : "text-[#64748b]")} />
                          {item.label}
                        </div>
                      </Link>
                    );
                  })}
                </nav>

                <div className="px-6 pt-6 border-t border-[#e2e8f0]">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-[#64748b] hover:text-red-600 hover:bg-red-50 rounded-lg h-9 px-2"
                    onClick={logout}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    <span className="text-xs font-semibold">Logout</span>
                  </Button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="flex-1 p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
