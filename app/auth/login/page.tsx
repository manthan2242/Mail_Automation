'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'motion/react';


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'employee'>('admin');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const router = useRouter();

  const handleEmailChange = (val: string) => {
    // Strip all spaces and characters that are not standard email characters
    const sanitized = val.replace(/[^a-zA-Z0-9._+@-]/g, '');
    setEmail(sanitized);
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 
      'Home', 'End'
    ];
    
    // Allow standard control key combinations (like Ctrl+A, Ctrl+C, Ctrl+V, etc.)
    if (e.ctrlKey || e.metaKey || allowedKeys.includes(e.key)) {
      return;
    }

    // Block spaces
    if (e.key === ' ') {
      e.preventDefault();
      return;
    }

    // Only allow standard email characters: alphanumeric and . _ + @ -
    const emailCharRegex = /^[a-zA-Z0-9._+@-]+$/;
    if (e.key.length === 1 && !emailCharRegex.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanEmail = email.trim().replace(/\s/g, '');
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(cleanEmail)) {
      toast.error('Please enter a valid email address (e.g. user@domain.com) without spaces or invalid characters.');
      return;
    }

    setLoading(true);
    const result = await login(cleanEmail, password, role);
    setLoading(false);
    if (!result.success) {
      toast.error(result.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white rounded-[32px] overflow-hidden">
          <CardHeader className="space-y-2 text-center pt-10 pb-6">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-[#6366f1] rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                <span className="text-white font-bold text-2xl">M</span>
              </div>
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight text-[#1e293b]">Mail Automation</CardTitle>
            <CardDescription className="text-[#64748b] font-medium">Access your email automation portal</CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onKeyDown={handleEmailKeyDown}
                  required
                  className="h-12 rounded-xl border-[#e2e8f0] focus:ring-[#6366f1] bg-white"
                />
              </div>



              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <Label htmlFor="password" title="Password" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Password</Label>
                  <a href="/auth/forgot-password" className="text-[10px] font-bold text-[#6366f1] hover:underline uppercase tracking-wider">Forgot password?</a>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 rounded-xl border-[#e2e8f0] focus:ring-[#6366f1] bg-white"
                />
              </div>

              <Button type="submit" className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white h-14 rounded-xl shadow-lg shadow-indigo-50 transition-all active:scale-[0.98] font-bold text-lg" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 bg-[#f8fafc] border-t border-[#e2e8f0] py-6">
            <div className="text-[11px] text-center text-[#64748b] font-medium">
              <p className="uppercase tracking-wide">Contact your administrator for access</p>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

