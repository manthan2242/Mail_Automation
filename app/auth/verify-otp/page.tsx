'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuthStore } from '@/store/authStore';

export default function VerifyOTPPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [sending, setSending] = useState(false);
  const { user, token } = useAuth();
  const { setAuth, verify2FA } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const sendOTP = async () => {
    if (resendTimer > 0) return;
    setSending(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'OTP sent to your email');
        setResendTimer(30);
      } else {
        toast.error(data.error || data.message || 'Failed to send OTP');
        if (data.message === "OTP already sent") setResendTimer(30);
      }
    } catch (error) {
      toast.error('Failed to send OTP');
    } finally {
      setSending(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Login successful');
        verify2FA();
        if (data.token) {
          setAuth(user!, data.token);
        }
        if (user?.role === 'admin') {
          router.push('/admin/dashboard');
        } else {
          if (user?.isFirstLogin) {
            router.push('/auth/change-password');
          } else {
            router.push('/employee/dashboard');
          }
        }
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card className="border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white rounded-[32px] overflow-hidden">
          <CardHeader className="text-center pt-10 pb-6">
            <CardTitle className="text-2xl font-bold text-[#1e293b]">Two-Factor Authentication</CardTitle>
            <CardDescription className="text-[#64748b] font-medium mt-2 px-4">
              We&apos;ve sent a 6-digit code to your email <span className="text-[#1e293b] font-bold">{user?.email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="code" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">Enter OTP Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="text-center text-3xl tracking-[0.5em] font-bold h-16 rounded-2xl border-[#e2e8f0] focus:ring-[#6366f1] bg-[#f8fafc]"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white h-14 rounded-xl shadow-lg shadow-indigo-50 transition-all active:scale-[0.98] font-bold text-lg" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Login'}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full text-[#64748b] hover:text-[#6366f1] hover:bg-[#eef2ff] rounded-xl font-bold text-xs uppercase tracking-wider h-10" 
                onClick={sendOTP}
                disabled={sending || resendTimer > 0}
              >
                {sending ? 'Sending...' : resendTimer > 0 ? `Resend in ${resendTimer}s` : "Didn't receive a code? Resend"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

