'use client';

import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Key, Plus, Trash2, Eye, EyeOff, Zap, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

const PROVIDERS = [
  { value: 'openai',      label: 'OpenAI',         desc: 'GPT-4o Mini',    prefix: 'sk-',     minLen: 40, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'gemini',      label: 'Google Gemini',   desc: 'Gemini 2.0 Flash', prefix: 'AIza',  minLen: 35, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'groq',        label: 'Groq',            desc: 'Llama 3.3 70B',  prefix: 'gsk_',    minLen: 30, color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'claude',      label: 'Claude',          desc: 'Claude Haiku',   prefix: 'sk-ant-', minLen: 40, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'openrouter',  label: 'OpenRouter',      desc: 'Mistral 7B',     prefix: 'sk-or-',  minLen: 30, color: 'bg-pink-50 text-pink-700 border-pink-200' },
];

interface AiKey {
  id: string;
  provider: string;
  maskedKey: string;
  isActive: boolean;
  createdAt: string;
}

export default function EmployeeSettingsPage() {
  const [keys, setKeys] = useState<AiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const { token } = useAuth();

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/employee/ai-keys', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setKeys(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchKeys();
  }, [token]);

  // ── Frontend format validation ──
  const formatError = useMemo(() => {
    const key = apiKeyInput.trim();
    if (!selectedProvider || !key) return null; // don't show error when empty

    if (key.length < 30) return 'API key must be at least 30 characters.';
    if (/^\d+$/.test(key)) return 'API key cannot be numeric-only.';

    const provider = PROVIDERS.find(p => p.value === selectedProvider);
    if (!provider) return null;

    if (!key.startsWith(provider.prefix)) {
      return `${provider.label} keys must start with "${provider.prefix}"`;
    }
    if (key.length < provider.minLen) {
      return `${provider.label} keys must be at least ${provider.minLen} characters.`;
    }

    return null; // valid format
  }, [apiKeyInput, selectedProvider]);

  const isFormValid = selectedProvider && apiKeyInput.trim().length >= 30 && !formatError;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setSaving(true);
    try {
      const res = await fetch('/api/employee/ai-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: selectedProvider, apiKey: apiKeyInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>API key <strong>verified</strong> and saved securely!</span>
          </div>
        );
        setSelectedProvider('');
        setApiKeyInput('');
        fetchKeys();
      } else {
        toast.error(data.error || 'Failed to save key');
      }
    } catch {
      toast.error('Failed to save key');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch('/api/employee/ai-keys', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, isActive: !isActive })
    });
    fetchKeys();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this API key?')) return;
    await fetch('/api/employee/ai-keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id })
    });
    toast.success('Key removed');
    fetchKeys();
  };

  const providerInfo = (value: string) => PROVIDERS.find(p => p.value === value);

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-3xl mx-auto">
        <header>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1e293b] tracking-tight">AI Settings</h1>
          <p className="text-xs md:text-sm text-[#64748b] mt-1">
            Add your personal API keys to use your preferred AI provider for email generation.
          </p>
        </header>

        {/* Security Note */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <span className="text-amber-500 text-lg mt-0.5">🔐</span>
          <div>
            <p className="text-sm font-bold text-amber-800">Security Notice</p>
            <p className="text-xs text-amber-700 mt-1">
              Your API keys are <strong>verified via a real API call</strong> before saving, then <strong>hashed with SHA-256</strong>.
              Only working, valid keys are accepted. Keys are never stored in plain text.
            </p>
          </div>
        </div>

        {/* Add New Key */}
        <Card className="border border-[#e2e8f0] rounded-[24px] bg-white shadow-sm overflow-hidden">
          <CardHeader className="bg-[#f8fafc] border-b border-[#e2e8f0] px-8 py-6">
            <CardTitle className="flex items-center gap-2 text-[#1e293b]">
              <Plus className="w-5 h-5 text-indigo-500" />
              Add AI Provider Key
            </CardTitle>
            <CardDescription>Each provider replaces the previous key. Only verified keys are accepted.</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleSave} className="space-y-6">
              {/* Provider Grid */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Select Provider</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PROVIDERS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => { setSelectedProvider(p.value); setApiKeyInput(''); }}
                      className={cn(
                        'flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all',
                        selectedProvider === p.value
                          ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                          : 'border-[#e2e8f0] hover:border-indigo-200 bg-white'
                      )}
                    >
                      <span className="text-sm font-bold text-[#1e293b]">{p.label}</span>
                      <span className="text-[10px] text-[#64748b]">{p.desc}</span>
                      {selectedProvider === p.value && (
                        <span className="text-[9px] text-indigo-500 font-mono mt-1">prefix: {p.prefix}***</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key Input */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">API Key</Label>
                <div className="relative">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    placeholder={
                      selectedProvider
                        ? `Starts with "${providerInfo(selectedProvider)?.prefix}..." (min ${providerInfo(selectedProvider)?.minLen} chars)`
                        : 'Select a provider first...'
                    }
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    disabled={!selectedProvider}
                    className={cn(
                      'h-12 rounded-2xl border bg-[#f8fafc] pr-12 font-mono text-sm',
                      formatError && apiKeyInput.trim()
                        ? 'border-red-300 focus:ring-red-300'
                        : apiKeyInput.trim() && !formatError
                        ? 'border-emerald-300 focus:ring-emerald-300'
                        : 'border-[#e2e8f0]'
                    )}
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#1e293b]"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Format validation feedback */}
                {apiKeyInput.trim() && formatError && (
                  <div className="flex items-center gap-1.5 text-red-600 text-xs font-medium mt-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {formatError}
                  </div>
                )}
                {apiKeyInput.trim() && !formatError && selectedProvider && (
                  <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium mt-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Format looks valid — will verify with {providerInfo(selectedProvider)?.label} on save.
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={saving || !isFormValid}
                className={cn(
                  'w-full rounded-xl h-12 font-bold transition-all',
                  saving
                    ? 'bg-amber-500 text-white'
                    : isFormValid
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying with {providerInfo(selectedProvider)?.label}...
                  </span>
                ) : (
                  'Verify & Save Key'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Saved Keys */}
        <Card className="border border-[#e2e8f0] rounded-[24px] bg-white shadow-sm overflow-hidden">
          <CardHeader className="bg-[#f8fafc] border-b border-[#e2e8f0] px-8 py-6">
            <CardTitle className="flex items-center gap-2 text-[#1e293b]">
              <Key className="w-5 h-5 text-indigo-500" />
              Saved Provider Keys
            </CardTitle>
            <CardDescription>All keys below were verified via real API calls before saving.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-16 text-center text-[#64748b] text-sm">Loading...</div>
            ) : keys.length === 0 ? (
              <div className="py-16 text-center">
                <Key className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-[#64748b] text-sm font-medium">No API keys saved yet.</p>
                <p className="text-[#94a3b8] text-xs mt-1">Add your first key above to get started.</p>
              </div>
            ) : (
              <AnimatePresence>
                {keys.map((key, i) => {
                  const pInfo = providerInfo(key.provider);
                  return (
                    <motion.div
                      key={key.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-8 py-5 border-b border-[#f1f5f9] last:border-0"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                          <Zap className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-[#1e293b] text-sm">{pInfo?.label || key.provider}</span>
                            <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider', pInfo?.color)}>
                              {pInfo?.desc}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-bold border border-emerald-200">✓ Verified</span>
                          </div>
                          <code className="text-xs text-[#64748b] font-mono bg-[#f8fafc] px-2 py-0.5 rounded-lg border border-[#e2e8f0]">
                            {key.maskedKey}
                          </code>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'rounded-lg px-3 h-8 text-[10px] font-bold uppercase',
                            key.isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-50'
                          )}
                          onClick={() => handleToggle(key.id, key.isActive)}
                        >
                          {key.isActive ? '● Active' : '○ Inactive'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg h-8 w-8"
                          onClick={() => handleDelete(key.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
