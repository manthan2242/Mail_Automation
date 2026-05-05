'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Sparkles, Send, RefreshCw, Eye, EyeOff, Zap, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

interface EmailConfig {
  id: string;
  email: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai:     'OpenAI (GPT-4o Mini)',
  gemini:     'Google Gemini',
  groq:       'Groq (Llama 3.3)',
  claude:     'Claude (Haiku)',
  openrouter: 'OpenRouter (Mistral)',
};

interface AiKey {
  id: string;
  provider: string;
  maskedKey: string;
  isActive: boolean;
}

export default function GenerateEmailPage() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipient, setRecipient] = useState('');
  const [sourceEmail, setSourceEmail] = useState('');
  const [configs, setConfigs] = useState<EmailConfig[]>([]);

  // AI provider state
  const [activeKeys, setActiveKeys] = useState<AiKey[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('default');
  const [rawKeyInput, setRawKeyInput] = useState('');
  const [showRawKey, setShowRawKey] = useState(false);
  const [keysLoading, setKeysLoading] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const { token, user } = useAuth();
  const router = useRouter();

  // Load employee's saved provider keys and available SMTP configs
  useEffect(() => {
    if (!token) return;
    
    // Fetch AI keys
    fetch('/api/employee/ai-keys', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setActiveKeys(data.filter((k: AiKey) => k.isActive));
      })
      .catch(() => {});
      
    // Fetch available SMTP configs
    fetch('/api/employee/assigned-emails', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setConfigs(data);
          if (data.length > 0) setSourceEmail(data[0].email);
        }
      })
      .catch(() => {});

    setKeysLoading(false);
  }, [token]);

  const handleGenerate = async () => {
    if (!subject) {
      toast.error('Please enter a subject or topic');
      return;
    }
    // If custom provider selected, require raw key
    if (selectedProvider !== 'default' && !rawKeyInput.trim()) {
      toast.error('Please enter your API key to use the selected provider');
      return;
    }

    setGenerating(true);
    try {
      const payload: Record<string, string> = { subject, sourceEmail };
      if (selectedProvider !== 'default') {
        payload.provider = selectedProvider;
        payload.rawKey = rawKeyInput.trim();
      }

      const res = await fetch('/api/employee/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setBody(data.body);
        toast.success('Email body generated!');
      } else {
        toast.error(data.error || 'Generation failed');
      }
    } catch {
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
      const configId = configs.find(c => c.email === sourceEmail)?.id;
      const res = await fetch('/api/employee/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject, body, to: recipient, fromEmail: sourceEmail, configId }),
      });
      if (res.ok) {
        toast.success('Email submitted to admin for approval');
        router.push('/employee/status');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Submission failed');
      }
    } catch {
      toast.error('Failed to submit email');
    } finally {
      setSending(false);
    }
  };

  const selectedKeyInfo = activeKeys.find(k => k.provider === selectedProvider);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-[#1e293b] tracking-tight">Generate Email</h1>
          <p className="text-[#64748b] mt-1">Use AI to draft professional emails and send them for approval.</p>
        </header>

        <Card className="border border-[#e2e8f0] shadow-sm bg-white rounded-[24px] overflow-hidden">
          <CardContent className="p-8 space-y-6">

            {/* Row 1: From + To */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">From Email</Label>
                <Select value={sourceEmail} onValueChange={(val) => setSourceEmail(val || '')}>
                  <SelectTrigger className="w-full rounded-2xl border-[#e2e8f0] h-12 bg-[#f8fafc] text-[#64748b] font-medium shadow-none px-4">
                    <SelectValue placeholder="Select Sender Email" />
                  </SelectTrigger>
                  <SelectContent className="bg-white rounded-xl border-[#e2e8f0] shadow-xl">
                    <SelectGroup>
                      <SelectLabel className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider px-3 py-2">Available Senders</SelectLabel>
                      {configs.map(config => (
                        <SelectItem key={config.id} value={config.email} className="rounded-lg mx-1 my-0.5 hover:bg-slate-50">
                          {config.email}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Recipient (Client Email)</Label>
                <Input
                  placeholder="client@example.com"
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  className="rounded-xl border-[#e2e8f0] h-12 bg-white text-[#1e293b] font-medium"
                  required
                />
                <p className="text-[10px] text-[#64748b] font-medium ml-1">📧 The final destination for this email after approval.</p>
              </div>
            </div>

            {/* AI Provider Selection */}
            <div className="space-y-3 p-5 bg-[#f8fafc] rounded-2xl border border-[#e2e8f0]">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-500" />
                  AI Provider
                </Label>
                <Link href="/employee/settings" className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold flex items-center gap-1">
                  Manage Keys <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              <Select value={selectedProvider} onValueChange={(v) => { setSelectedProvider(v || ''); setRawKeyInput(''); }}>
                <SelectTrigger className="w-full rounded-2xl border-[#e2e8f0] h-12 bg-white text-[#64748b] font-medium shadow-none px-4">
                  <SelectValue placeholder="Select AI Provider" />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-xl border-[#e2e8f0] shadow-xl">
                  <SelectItem value="default" className="rounded-lg mx-1 my-0.5">
                    <span className="font-medium">🤖 Default (Global Gemini)</span>
                  </SelectItem>
                  {keysLoading ? (
                    <SelectItem value="loading" disabled className="text-slate-400">Loading your keys...</SelectItem>
                  ) : activeKeys.length === 0 ? (
                    <SelectItem value="none" disabled className="text-slate-400">No keys saved — Add in AI Settings</SelectItem>
                  ) : (
                    activeKeys.map(k => (
                      <SelectItem key={k.id} value={k.provider} className="rounded-lg mx-1 my-0.5">
                        <span className="font-medium">{PROVIDER_LABELS[k.provider] || k.provider}</span>
                        <span className="ml-2 text-[10px] text-slate-400 font-mono">{k.maskedKey}</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {/* Raw Key input — shown when a custom provider is selected */}
              {selectedProvider !== 'default' && (
                <div className="space-y-2 pt-1">
                  <Label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                    🔑 Enter your {PROVIDER_LABELS[selectedProvider]} key for this session
                  </Label>
                  <div className="relative">
                    <Input
                      type={showRawKey ? 'text' : 'password'}
                      placeholder={selectedKeyInfo ? `Saved as: ${selectedKeyInfo.maskedKey}` : 'Paste your API key...'}
                      value={rawKeyInput}
                      onChange={e => setRawKeyInput(e.target.value)}
                      className="h-12 rounded-2xl border-amber-200 bg-white pr-12 font-mono text-sm focus:ring-amber-300"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#1e293b]"
                      onClick={() => setShowRawKey(!showRawKey)}
                    >
                      {showRawKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-600 font-medium">
                    ⚠️ Your key is never stored — it's only used for this request and validated against your saved hash.
                  </p>
                </div>
              )}
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Subject / Topic</Label>
              <div className="flex gap-3">
                <Input
                  placeholder="e.g. Request for annual leave in July"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="rounded-xl border-[#e2e8f0] h-12 flex-1"
                />
                <Button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="bg-[#eef2ff] text-[#6366f1] hover:bg-[#e0e7ff] border-none rounded-xl px-6 h-12 font-bold shrink-0"
                >
                  {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  {generating ? 'Generating...' : 'AI Draft'}
                </Button>
              </div>
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Email Body</Label>
              <Textarea
                placeholder="The AI generated content will appear here..."
                value={body}
                onChange={e => setBody(e.target.value)}
                className="min-h-[320px] rounded-xl border-[#e2e8f0] leading-relaxed p-6 text-sm"
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSend}
                disabled={sending || !body}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white px-10 h-14 rounded-xl shadow-lg shadow-indigo-100 font-bold"
              >
                {sending ? 'Submitting...' : <><Send className="w-4 h-4 mr-2" />Submit for Approval</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Banner */}
        <div className="p-5 bg-[#fffbeb] border border-[#fef3c7] rounded-2xl flex items-start gap-4">
          <div className="p-2 bg-[#fef3c7] rounded-xl text-[#d97706]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="text-sm text-[#92400e]">
            <p className="font-bold mb-1 uppercase tracking-wider text-[10px]">How it works</p>
            <p className="leading-relaxed">
              Your email goes to the Admin dashboard for review. Once approved, it is sent via the company's official SMTP server.
              Want to use your own AI key? Add it in <Link href="/employee/settings" className="underline font-bold">AI Settings</Link>.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
