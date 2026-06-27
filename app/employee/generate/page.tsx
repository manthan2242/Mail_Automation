'use client';

import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Sparkles, Send, RefreshCw, Eye, EyeOff, Zap, ExternalLink, X, Save, History, ChevronRight, Search, Reply } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

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
  const [sourceEmail, setSourceEmail] = useState('');
  
  // Recipients, CC, BCC
  const [recipients, setRecipients] = useState<string[]>([]);
  const [toInput, setToInput] = useState('');
  const [cc, setCc] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [bcc, setBcc] = useState<string[]>([]);
  const [bccInput, setBccInput] = useState('');
  
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  const [suggestions, setSuggestions] = useState<{ name: string; email: string }[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [activeField, setActiveField] = useState<'to' | 'cc' | 'bcc' | null>(null);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const ccWrapperRef = useRef<HTMLDivElement>(null);
  const bccWrapperRef = useRef<HTMLDivElement>(null);

  // History & Save Draft States
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMail, setSelectedMail] = useState<any | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        (wrapperRef.current && wrapperRef.current.contains(target)) ||
        (ccWrapperRef.current && ccWrapperRef.current.contains(target)) ||
        (bccWrapperRef.current && bccWrapperRef.current.contains(target))
      ) {
        return;
      }
      setActiveField(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (query: string) => {
    if (!query.trim() || !token) {
      setSuggestions([]);
      return;
    }
    setIsLoadingSuggestions(true);
    try {
      const res = await fetch(`/api/email-suggestions?query=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setSuggestions(data);
        setHighlightedIndex(data.length > 0 ? 0 : -1);
      }
    } catch (err) {
      console.error('Suggestions fetch error:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleInputChange = (field: 'to' | 'cc' | 'bcc', val: string) => {
    if (val.includes(',')) {
      toast.error('Comma (,) is not accepted in recipient fields');
      val = val.replace(/,/g, '');
    }
    if (field === 'to') setToInput(val);
    if (field === 'cc') setCcInput(val);
    if (field === 'bcc') setBccInput(val);
    setActiveField(field);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const addRecipient = (field: 'to' | 'cc' | 'bcc', email: string) => {
    const cleanEmail = email.trim();
    if (cleanEmail) {
      if (field === 'to' && !recipients.includes(cleanEmail)) {
        setRecipients([...recipients, cleanEmail]);
      } else if (field === 'cc' && !cc.includes(cleanEmail)) {
        setCc([...cc, cleanEmail]);
      } else if (field === 'bcc' && !bcc.includes(cleanEmail)) {
        setBcc([...bcc, cleanEmail]);
      }
    }
    if (field === 'to') setToInput('');
    if (field === 'cc') setCcInput('');
    if (field === 'bcc') setBccInput('');
    setActiveField(null);
    setSuggestions([]);
    setHighlightedIndex(-1);
  };

  const removeRecipient = (field: 'to' | 'cc' | 'bcc', email: string) => {
    if (field === 'to') setRecipients(recipients.filter(r => r !== email));
    if (field === 'cc') setCc(cc.filter(r => r !== email));
    if (field === 'bcc') setBcc(bcc.filter(r => r !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: 'to' | 'cc' | 'bcc') => {
    const currentInput = field === 'to' ? toInput : field === 'cc' ? ccInput : bccInput;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        addRecipient(field, suggestions[highlightedIndex].email);
      } else if (currentInput.includes('@')) {
        addRecipient(field, currentInput);
      }
    } else if (e.key === 'Escape') {
      setActiveField(null);
    }
  };
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

  const fetchHistory = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/employee/emails', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const reuseTemplate = (item: any) => {
    setSubject(item.subject || '');
    setBody(item.body || '');
    if (item.fromEmail) {
      setSourceEmail(item.fromEmail);
    }
    
    // Parse recipients, cc, bcc
    const toList = item.to ? item.to.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
    const ccList = item.cc ? item.cc.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
    const bccList = item.bcc ? item.bcc.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
    
    setRecipients(toList);
    setCc(ccList);
    setBcc(bccList);
    
    if (ccList.length > 0) setShowCc(true);
    if (bccList.length > 0) setShowBcc(true);

    setSelectedMail(null);
    toast.info('Draft/Template loaded in generator');
  };

  const handleReply = (item: any) => {
    let replySubject = item.subject || '';
    if (replySubject && !/^(re|Re):\s*/i.test(replySubject)) {
      replySubject = `Re: ${replySubject}`;
    }
    setSubject(replySubject);

    // Keep email body clean/empty as requested
    setBody('');

    if (item.fromEmail) {
      setSourceEmail(item.fromEmail);
    }
    
    // Parse recipients, cc, bcc
    const toList = item.to ? item.to.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
    const ccList = item.cc ? item.cc.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
    const bccList = item.bcc ? item.bcc.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
    
    setRecipients(toList);
    setCc(ccList);
    setBcc(bccList);
    
    if (ccList.length > 0) setShowCc(true);
    if (bccList.length > 0) setShowBcc(true);

    setSelectedMail(null);
    toast.info('Reply drafted with original recipients');
  };

  const getFilteredHistory = () => {
    if (!searchQuery) return history;
    const query = searchQuery.toLowerCase();
    return history.filter(item => 
      item.subject?.toLowerCase().includes(query) ||
      item.to?.toLowerCase().includes(query) ||
      item.body?.toLowerCase().includes(query)
    );
  };

  // Load employee's saved provider keys, available SMTP configs and mail history
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
        }
      })
      .catch(() => {});

    // Fetch history
    fetchHistory();

    setKeysLoading(false);
  }, [token, user]);

  const handleGenerate = async () => {
    if (!sourceEmail) {
      toast.error('From email is required');
      return;
    }
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

  const handleSend = async (isDraft: boolean = false) => {
    if (!sourceEmail) {
      toast.error('From email is required');
      return;
    }
    let finalRecipients = [...recipients];
    if (toInput.trim() && toInput.includes('@') && !finalRecipients.includes(toInput.trim())) {
      finalRecipients.push(toInput.trim());
    }

    if (!isDraft && finalRecipients.length === 0) {
      toast.error('At least one recipient email is required');
      return;
    }
    if (!subject || !body) {
      toast.error('Subject and body are required');
      return;
    }
    
    if (isDraft) {
      setSaveLoading(true);
    } else {
      setSending(true);
    }

    try {
      const configId = configs.find(c => c.email === sourceEmail)?.id;
      const res = await fetch('/api/employee/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          subject, 
          body, 
          to: finalRecipients.join(', '), 
          cc: cc.join(', '),
          bcc: bcc.join(', '),
          fromEmail: sourceEmail, 
          configId,
          status: isDraft ? 'DRAFT' : 'PENDING'
        }),
      });
      if (res.ok) {
        if (isDraft) {
          toast.success('Email draft saved successfully!');
          fetchHistory();
        } else {
          toast.success('Email submitted to admin for approval');
          router.push('/employee/status');
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Submission failed');
      }
    } catch {
      toast.error('Failed to submit email');
    } finally {
      setSending(false);
      setSaveLoading(false);
    }
  };

  const selectedKeyInfo = activeKeys.find(k => k.provider === selectedProvider);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 pb-10">
        <header>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1e293b] tracking-tight">Generate Email</h1>
          <p className="text-xs md:text-sm text-[#64748b] mt-1">Use AI to draft professional emails and submit them for approval.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Email Generator - 7/12 */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="border border-[#e2e8f0] shadow-sm bg-white rounded-[24px] overflow-hidden">
              <CardContent className="p-8 space-y-6">

                {/* Row 1: From + To */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">From Email</Label>
                    <Select value={sourceEmail} onValueChange={(val) => setSourceEmail(val || '')}>
                      <SelectTrigger className="w-full rounded-2xl border-[#e2e8f0] h-12 bg-[#f8fafc] text-[#64748b] font-medium shadow-none px-4">
                        <SelectValue placeholder="Select Sender Email">
                          {sourceEmail}
                        </SelectValue>
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

                  <div className="space-y-2 relative" ref={wrapperRef}>
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Recipient (Client Email) *</Label>
                      <div className="text-gray-400 text-xs font-medium space-x-2 shrink-0 select-none">
                        <span onClick={() => setShowCc(!showCc)} className="cursor-pointer hover:text-gray-800">Cc</span>
                        <span onClick={() => setShowBcc(!showBcc)} className="cursor-pointer hover:text-gray-800">Bcc</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-[#e2e8f0] bg-white min-h-[48px] focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
                      {recipients.map((email, idx) => (
                        <div key={idx} className="flex items-center bg-[#f1f5f9] rounded-lg px-2.5 py-1 text-xs font-semibold text-[#334155] border border-slate-200">
                          <span className="truncate max-w-[150px]">{email}</span>
                          <button 
                            type="button" 
                            onClick={() => removeRecipient('to', email)}
                            className="ml-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <input
                        type="text"
                        placeholder={recipients.length === 0 ? "client@example.com" : ""}
                        value={toInput}
                        onChange={e => handleInputChange('to', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, 'to')}
                        className="flex-1 min-w-[120px] outline-none text-sm font-medium text-[#1e293b] bg-transparent"
                      />
                    </div>
                    
                    {activeField === 'to' && (suggestions.length > 0 || isLoadingSuggestions) && (
                      <div className="absolute top-[calc(100%+4px)] left-0 w-full max-h-[220px] overflow-y-auto bg-white border border-[#e2e8f0] shadow-xl rounded-2xl z-50 py-1.5">
                        {isLoadingSuggestions ? (
                          <div className="px-4 py-2 text-xs text-slate-400">Loading suggestions...</div>
                        ) : (
                          suggestions.map((c, i) => (
                            <div 
                              key={i} 
                              className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 transition-colors ${highlightedIndex === i ? 'bg-indigo-50/75 text-indigo-900' : 'hover:bg-slate-50 text-slate-700'}`} 
                              onMouseDown={() => addRecipient('to', c.email)}
                            >
                              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">{c.name.charAt(0)}</div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold truncate">{c.name}</span>
                                <span className="text-[10px] text-slate-400 truncate">{c.email}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* CC input */}
                {showCc && (
                  <div className="space-y-2 relative" ref={ccWrapperRef}>
                    <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">CC (Optional)</Label>
                    <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-[#e2e8f0] bg-white min-h-[48px] focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
                      {cc.map((email, idx) => (
                        <div key={idx} className="flex items-center bg-[#f1f5f9] rounded-lg px-2.5 py-1 text-xs font-semibold text-[#334155] border border-slate-200">
                          <span className="truncate max-w-[150px]">{email}</span>
                          <button 
                            type="button" 
                            onClick={() => removeRecipient('cc', email)}
                            className="ml-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <input
                        type="text"
                        placeholder={cc.length === 0 ? "cc@example.com" : ""}
                        value={ccInput}
                        onChange={e => handleInputChange('cc', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, 'cc')}
                        className="flex-1 min-w-[120px] outline-none text-sm font-medium text-[#1e293b] bg-transparent"
                      />
                    </div>
                    {activeField === 'cc' && (suggestions.length > 0 || isLoadingSuggestions) && (
                      <div className="absolute top-[calc(100%+4px)] left-0 w-full max-h-[220px] overflow-y-auto bg-white border border-[#e2e8f0] shadow-xl rounded-2xl z-50 py-1.5">
                        {isLoadingSuggestions ? (
                          <div className="px-4 py-2 text-xs text-slate-400">Loading suggestions...</div>
                        ) : (
                          suggestions.map((c, i) => (
                            <div 
                              key={i} 
                              className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 transition-colors ${highlightedIndex === i ? 'bg-indigo-50/75 text-indigo-900' : 'hover:bg-slate-50 text-slate-700'}`} 
                              onMouseDown={() => addRecipient('cc', c.email)}
                            >
                              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">{c.name.charAt(0)}</div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold truncate">{c.name}</span>
                                <span className="text-[10px] text-slate-400 truncate">{c.email}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* BCC input */}
                {showBcc && (
                  <div className="space-y-2 relative" ref={bccWrapperRef}>
                    <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">BCC (Optional)</Label>
                    <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-[#e2e8f0] bg-white min-h-[48px] focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
                      {bcc.map((email, idx) => (
                        <div key={idx} className="flex items-center bg-[#f1f5f9] rounded-lg px-2.5 py-1 text-xs font-semibold text-[#334155] border border-slate-200">
                          <span className="truncate max-w-[150px]">{email}</span>
                          <button 
                            type="button" 
                            onClick={() => removeRecipient('bcc', email)}
                            className="ml-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <input
                        type="text"
                        placeholder={bcc.length === 0 ? "bcc@example.com" : ""}
                        value={bccInput}
                        onChange={e => handleInputChange('bcc', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, 'bcc')}
                        className="flex-1 min-w-[120px] outline-none text-sm font-medium text-[#1e293b] bg-transparent"
                      />
                    </div>
                    {activeField === 'bcc' && (suggestions.length > 0 || isLoadingSuggestions) && (
                      <div className="absolute top-[calc(100%+4px)] left-0 w-full max-h-[220px] overflow-y-auto bg-white border border-[#e2e8f0] shadow-xl rounded-2xl z-50 py-1.5">
                        {isLoadingSuggestions ? (
                          <div className="px-4 py-2 text-xs text-slate-400">Loading suggestions...</div>
                        ) : (
                          suggestions.map((c, i) => (
                            <div 
                              key={i} 
                              className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 transition-colors ${highlightedIndex === i ? 'bg-indigo-50/75 text-indigo-900' : 'hover:bg-slate-50 text-slate-700'}`} 
                              onMouseDown={() => addRecipient('bcc', c.email)}
                            >
                              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">{c.name.charAt(0)}</div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold truncate">{c.name}</span>
                                <span className="text-[10px] text-slate-400 truncate">{c.email}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

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
                      <SelectValue placeholder="Select AI Provider">
                        {selectedProvider === 'default' ? '🤖 Default (Global Gemini)' : (PROVIDER_LABELS[selectedProvider] || selectedProvider)}
                      </SelectValue>
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

                {/* Submit & Draft Actions */}
                <div className="flex items-center justify-between pt-2">
                  <Button 
                    variant="ghost"
                    size="sm"
                    className="text-[#64748b] hover:text-[#1e293b]"
                    onClick={() => {
                      setRecipients([]);
                      setCc([]);
                      setBcc([]);
                      setToInput('');
                      setCcInput('');
                      setBccInput('');
                      setSubject('');
                      setBody('');
                      setShowCc(false);
                      setShowBcc(false);
                    }}
                  >
                    Clear All
                  </Button>
                  <div className="flex gap-3">
                    <Button 
                      variant="outline"
                      className="rounded-xl h-12 px-6 border-[#e2e8f0] hover:bg-slate-50 font-bold gap-2"
                      disabled={saveLoading || sending}
                      onClick={() => handleSend(true)}
                    >
                      {saveLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Draft
                    </Button>
                    <Button 
                      className="rounded-xl h-12 px-8 bg-[#6366f1] hover:bg-[#4f46e5] text-white shadow-md shadow-indigo-100 font-bold gap-2"
                      disabled={sending || saveLoading}
                      onClick={() => handleSend(false)}
                    >
                      {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Submit for Approval
                    </Button>
                  </div>
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

          {/* Mail History Sidebar - 5/12 */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border border-[#e2e8f0] shadow-sm bg-white rounded-[24px] h-full flex flex-col overflow-hidden">
              <CardHeader className="bg-white border-b border-[#e2e8f0]/60 px-8 py-6">
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-lg font-bold text-[#1e293b] flex items-center gap-2">
                    <History className="w-5 h-5 text-slate-400" />
                    Mail History & Drafts
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => fetchHistory()} className="h-8 w-8 rounded-full">
                    <RefreshCw className="w-4 h-4 text-slate-400" />
                  </Button>
                </div>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Search by recipient, subject..." 
                    className="pl-10 h-10 rounded-xl bg-slate-50 border-none text-sm placeholder:text-slate-400"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </CardHeader>
              
              <CardContent className="p-0 flex-1 overflow-auto max-h-[700px]">
                {historyLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                    <RefreshCw className="w-8 h-8 animate-spin opacity-20" />
                    <p className="text-sm font-medium">Loading history...</p>
                  </div>
                ) : getFilteredHistory().length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                      <History className="w-6 h-6 opacity-30" />
                    </div>
                    <p className="text-sm font-medium">No results found.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    <AnimatePresence mode="popLayout">
                      {getFilteredHistory().map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="group p-6 hover:bg-slate-50/50 cursor-pointer transition-colors relative"
                          onClick={() => setSelectedMail(item)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className={cn(
                              "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter",
                              item.status === 'SENT' ? "bg-indigo-50 text-indigo-600 border border-indigo-100" :
                              item.status === 'PENDING' ? "bg-amber-50 text-amber-600 border border-amber-100" :
                              item.status === 'DRAFT' ? "bg-slate-100 text-slate-700" :
                              item.status === 'APPROVED' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                              item.status === 'REJECTED' ? "bg-rose-50 text-rose-600 border border-rose-100" :
                              "bg-slate-50 text-slate-505"
                            )}>
                              {item.status}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {format(new Date(item.createdAt), 'MMM dd, HH:mm')}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-[#1e293b] group-hover:text-indigo-600 transition-colors line-clamp-1 truncate pr-6">
                            {item.subject || '(No Subject)'}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                            <span className="font-bold text-slate-400 truncate max-w-[150px]">To:</span> {item.to || '(No Recipient)'}
                          </p>
                          <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-200 group-hover:text-slate-400 transition-all group-hover:translate-x-1" />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* View Details Modal */}
      <Dialog open={!!selectedMail} onOpenChange={(open) => !open && setSelectedMail(null)}>
        <DialogContent className="w-[calc(100%-32px)] sm:max-w-[650px] bg-white rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="px-8 py-6 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-3 mb-2">
               <span className={cn(
                  "text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter",
                  selectedMail?.status === 'SENT' ? "bg-indigo-50 text-indigo-600 border border-indigo-100" :
                  selectedMail?.status === 'PENDING' ? "bg-amber-50 text-amber-600 border border-amber-100" :
                  selectedMail?.status === 'DRAFT' ? "bg-slate-100 text-slate-700" :
                  selectedMail?.status === 'APPROVED' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                  selectedMail?.status === 'REJECTED' ? "bg-rose-50 text-rose-600 border border-rose-100" :
                  "bg-slate-50 text-slate-500"
                )}>
                  {selectedMail?.status}
                </span>
                <span className="text-xs text-slate-400">
                  {selectedMail && format(new Date(selectedMail.createdAt), 'eeee, MMMM dd, yyyy @ HH:mm')}
                </span>
            </div>
            <DialogTitle className="text-2xl font-black text-[#1e293b] leading-tight pr-8">
              {selectedMail?.subject || '(No Subject)'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-8 space-y-6 max-h-[70vh] overflow-auto">
            {selectedMail?.fromEmail && (
              <div className="flex items-center gap-2 p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
                  From
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">From</p>
                  <p className="text-sm font-bold text-slate-700 truncate">{selectedMail.fromEmail}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
              <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
                To
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">To</p>
                <p className="text-sm font-bold text-slate-700 truncate">{selectedMail?.to || '(No Recipient)'}</p>
              </div>
            </div>

            {selectedMail?.cc && selectedMail.cc.trim() && (
              <div className="flex items-start gap-2 p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                  CC
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CC</p>
                  <p className="text-sm font-bold text-slate-700 break-all">{selectedMail.cc}</p>
                </div>
              </div>
            )}

            {selectedMail?.bcc && selectedMail.bcc.trim() && (
              <div className="flex items-start gap-2 p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-purple-600 text-xs font-bold shrink-0">
                  BCC
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">BCC</p>
                  <p className="text-sm font-bold text-slate-700 break-all">{selectedMail.bcc}</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-100 p-6 whitespace-pre-wrap text-[#334155] text-sm leading-relaxed shadow-sm">
                {selectedMail?.body}
            </div>

            {selectedMail?.adminComment && (
              <div className="p-5 bg-rose-50 rounded-xl border border-rose-100">
                <p className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">Admin Comment:</p>
                <p className="text-sm text-rose-700 italic whitespace-pre-wrap">{selectedMail.adminComment}</p>
              </div>
            )}
            
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={() => selectedMail && handleReply(selectedMail)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 font-bold gap-2 shadow-md shadow-indigo-100"
              >
                <Reply className="w-4 h-4" />
                Reply
              </Button>
              <Button 
                onClick={() => selectedMail && reuseTemplate(selectedMail)}
                variant="outline"
                className="flex-1 rounded-xl h-12 border-slate-200 hover:bg-slate-50 font-bold gap-2 text-slate-700"
              >
                <RefreshCw className="w-4 h-4 text-slate-400" />
                Reuse Template
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setSelectedMail(null)}
                className="flex-1 sm:flex-initial rounded-xl h-12 text-slate-500 hover:text-slate-800 font-bold"
              >
                Close View
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
