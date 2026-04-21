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

  // Removed conflicting useEffect that bypasses OTP and change password

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(email, password, role);
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
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-xl border-[#e2e8f0] focus:ring-[#6366f1] bg-white"
                />
              </div>



              <div className="space-y-2">
                <Label htmlFor="password" title="Password" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">Password</Label>
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

