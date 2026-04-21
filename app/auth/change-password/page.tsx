'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, token } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        toast.success('Password changed successfully');
        router.push('/auth/verify-otp');
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
      <Card className="w-full max-w-md border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white rounded-[32px] overflow-hidden">
        <CardHeader className="text-center pt-10 pb-6">
          <CardTitle className="text-2xl font-bold text-[#1e293b]">Change Password</CardTitle>
          <CardDescription className="text-[#64748b] font-medium mt-2 px-4">
            You are logging in for the first time. Please set a new secure password.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password" title="New Password" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">New Password</Label>
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
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" title="Confirm New Password" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-12 rounded-xl border-[#e2e8f0] focus:ring-[#6366f1] bg-white"
              />
            </div>
            <Button type="submit" className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white h-14 rounded-xl shadow-lg shadow-indigo-50 transition-all active:scale-[0.98] font-bold text-lg" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

