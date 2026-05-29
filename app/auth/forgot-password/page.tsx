'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Verification code sent to your email');
        setStep(2);
      } else {
        toast.error(data.error || 'Failed to send verification code');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !newPassword || !confirmPassword) {
      toast.error('All fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          code: code.trim(), 
          newPassword, 
          confirmPassword 
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Password updated successfully! Please log in.');
        router.push('/auth/login');
      } else {
        toast.error(data.error || 'Failed to reset password');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
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
            <CardTitle className="text-3xl font-bold tracking-tight text-[#1e293b]">Reset Password</CardTitle>
            <CardDescription className="text-[#64748b] font-medium px-4">
              {step === 1 
                ? 'Enter your email address to receive a secure password reset OTP code' 
                : `We've sent a secure 6-digit code to ${email}`
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-8 pb-8">
            {step === 1 ? (
              <form onSubmit={handleRequestOTP} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 rounded-xl border-[#e2e8f0] focus:ring-[#6366f1] bg-white font-medium text-[#1e293b]"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white h-14 rounded-xl shadow-lg shadow-indigo-50 transition-all active:scale-[0.98] font-bold text-lg"
                >
                  {loading ? 'Sending...' : 'Send Reset Code'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">OTP Code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    className="h-12 text-center text-xl tracking-[0.2em] font-bold rounded-xl border-[#e2e8f0] focus:ring-[#6366f1] bg-[#f8fafc] text-[#1e293b]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">Enter New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="h-12 rounded-xl border-[#e2e8f0] focus:ring-[#6366f1] bg-white font-medium text-[#1e293b]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-12 rounded-xl border-[#e2e8f0] focus:ring-[#6366f1] bg-white font-medium text-[#1e293b]"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white h-14 rounded-xl shadow-lg shadow-indigo-50 transition-all active:scale-[0.98] font-bold text-lg"
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>
            )}
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-4 bg-[#f8fafc] border-t border-[#e2e8f0] py-6">
            <a 
              href="/auth/login" 
              className="text-xs font-bold text-[#64748b] hover:text-[#6366f1] transition-colors uppercase tracking-wider text-center"
            >
              Back to Sign In
            </a>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
