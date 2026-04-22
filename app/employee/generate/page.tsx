'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Sparkles, Send, RefreshCw, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { APP_CONFIG } from '@/lib/constants';

export default function GenerateEmailPage() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipient, setRecipient] = useState('');
  const [sourceEmail] = useState(APP_CONFIG.DEFAULT_SENDER);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const { token, user } = useAuth();
  const router = useRouter();

  // Auto-set recipient to logged-in employee's email
  useEffect(() => {
    if (user?.email) {
      setRecipient(user.email);
    }
  }, [user]);

  const handleGenerate = async () => {
    
    if (!subject) {
      toast.error('Please enter a subject or topic');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/employee/generate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ subject, sourceEmail: APP_CONFIG.DEFAULT_SENDER }),
      });
      const data = await res.json();
      if (res.ok) {
        setBody(data.body);
        toast.success('Email body generated!');
      } else {
        toast.error(data.error || "Generation failed. Please check assigned emails.");
      }
    } catch (error) {
      toast.error('Failed to generate email');
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!recipient || !subject || !body) {
      toast.error('Recipient, Subject and body are required');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/employee/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subject,
          body,
          to: recipient,
          fromEmail: APP_CONFIG.DEFAULT_SENDER
        }),
      });
      if (res.ok) {
        toast.success('Email submitted to admin for approval');
        router.push('/employee/status');
      } else {
        const data = await res.json();
        toast.error(data.error || "Submission failed");
      }
    } catch (error) {
      toast.error('Failed to submit email');
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="page-title">
            <h1 className="text-3xl font-bold text-[#1e293b] tracking-tight">Generate Email</h1>
            <p className="text-[#64748b] mt-1">Use AI to draft professional emails and send them for approval.</p>
          </div>
          {user?.role === 'admin' && (
            <Button 
               variant="outline" 
               className="border-indigo-100 text-[#6366f1] hover:bg-indigo-50"
               onClick={() => router.push('/admin/smtp')}
            >
              + Add Email Account
            </Button>
          )}
        </header>

        <div className="grid grid-cols-1 gap-8">
          <Card className="border border-[#e2e8f0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white rounded-[24px] overflow-hidden">

            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">From Email</Label>
                  <Input
                    value={sourceEmail}
                    readOnly
                    disabled
                    className="rounded-xl border-[#e2e8f0] h-12 bg-[#f8fafc] text-[#1e293b] font-medium cursor-not-allowed"
                  />
                  <p className="text-[10px] text-[#64748b] font-medium ml-1">🔒 Sender is fixed by admin policy.</p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="to" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Recipient Email (Your Email)</Label>
                  <Input
                    id="to"
                    value={recipient}
                    readOnly
                    disabled
                    className="rounded-xl border-[#e2e8f0] h-12 bg-[#f8fafc] text-[#1e293b] font-medium cursor-not-allowed"
                  />
                  <p className="text-[10px] text-[#64748b] font-medium ml-1">📧 Emails are sent only to your registered email.</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="subject" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Subject / Topic</Label>
                <div className="flex gap-3">
                  <Input
                    id="subject"
                    placeholder="e.g. Request for annual leave in July"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="rounded-xl border-[#e2e8f0] focus:ring-[#6366f1] h-12"
                  />
                  <Button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="bg-[#eef2ff] text-[#6366f1] hover:bg-[#e0e7ff] border-none rounded-xl px-6 h-12 font-bold"
                  >
                    {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {generating ? 'Generating...' : 'AI Draft'}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="body" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Email Body</Label>
                <Textarea
                  id="body"
                  placeholder="The AI generated content will appear here..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="min-h-[350px] rounded-xl border-[#e2e8f0] focus:ring-[#6366f1] leading-relaxed p-6 text-sm"
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSend}
                  disabled={sending || !body}
                  className="bg-[#6366f1] hover:bg-[#4f46e5] text-white px-10 h-14 rounded-xl shadow-lg shadow-indigo-100 transition-all active:scale-[0.98] font-bold"
                >
                  {sending ? 'Submitting...' : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit for Approval
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="p-6 bg-[#fffbeb] border border-[#fef3c7] rounded-2xl flex items-start space-x-4">
            <div className="p-2 bg-[#fef3c7] rounded-xl text-[#d97706] mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="text-sm text-[#92400e]">
              <p className="font-bold mb-1 uppercase tracking-wider text-[10px]">How it works:</p>
              <p className="leading-relaxed">Your email will be sent to the Admin dashboard first. Once approved, it will be sent to the recipient via the company&apos;s official SMTP server.</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
