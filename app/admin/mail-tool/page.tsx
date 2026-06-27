'use client';

import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmailAutocomplete } from '@/components/ui/EmailAutocomplete';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Search, 
  Mail, 
  Send, 
  Save, 
  Sparkles, 
  History, 
  ChevronRight, 
  Clock, 
  Search as SearchIcon,
  RefreshCw,
  FileText,
  X,
  Reply
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface MailHistoryItem {
  id: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
}

interface EmailConfig {
  id: string;
  email: string;
}

// Helper function to parse comma-separated emails
const parseEmails = (emailString: string): string[] => {
  return emailString
    .split(',')
    .map(email => email.trim())
    .filter(email => email.length > 0);
};

// Helper function to validate email format
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to validate multiple emails
const validateEmails = (emailString: string): { valid: boolean; message: string } => {
  if (!emailString.trim()) {
    return { valid: false, message: 'Email field is required' };
  }
  
  const emails = parseEmails(emailString);
  
  if (emails.length === 0) {
    return { valid: false, message: 'Please enter at least one email address' };
  }
  
  const invalidEmails = emails.filter(email => !isValidEmail(email));
  
  if (invalidEmails.length > 0) {
    return { 
      valid: false, 
      message: `Invalid email format: ${invalidEmails.join(', ')}. Use comma to separate multiple emails.` 
    };
  }
  
  return { valid: true, message: '' };
};

export default function AdminMailTool() {
  const [history, setHistory] = useState<MailHistoryItem[]>([]);
  const [configs, setConfigs] = useState<EmailConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMail, setSelectedMail] = useState<MailHistoryItem | null>(null);
  
  const [mailData, setMailData] = useState({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    body: ''
  });

  const { token } = useAuth();

  const [toEmails, setToEmails] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [bccEmails, setBccEmails] = useState<string[]>([]);
  
  const [toInput, setToInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  
  const [suggestions, setSuggestions] = useState<{ name: string; email: string }[]>([]);
  const [activeField, setActiveField] = useState<'to' | 'cc' | 'bcc' | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout|null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setActiveField(null);
      }
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
    if (!email.trim() || !email.includes('@')) return;
    if (field === 'to' && !toEmails.includes(email)) setToEmails([...toEmails, email]);
    if (field === 'cc' && !ccEmails.includes(email)) setCcEmails([...ccEmails, email]);
    if (field === 'bcc' && !bccEmails.includes(email)) setBccEmails([...bccEmails, email]);
    if (field === 'to') setToInput('');
    if (field === 'cc') setCcInput('');
    if (field === 'bcc') setBccInput('');
    setActiveField(null);
    setSuggestions([]);
    setHighlightedIndex(-1);
  };

  const removeRecipient = (field: 'to' | 'cc' | 'bcc', email: string) => {
    if (field === 'to') setToEmails(toEmails.filter(e => e !== email));
    if (field === 'cc') setCcEmails(ccEmails.filter(e => e !== email));
    if (field === 'bcc') setBccEmails(bccEmails.filter(e => e !== email));
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
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        e.preventDefault();
        addRecipient(field, suggestions[highlightedIndex].email);
      } else if (currentInput.includes('@')) {
        e.preventDefault();
        addRecipient(field, currentInput);
      }
    } else if (e.key === 'Escape') {
      setActiveField(null);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/admin/mail/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

    const fetchConfigs = async () => {
      try {
        const res = await fetch('/api/admin/email-configs', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setConfigs(data);
          setSelectedConfigId('');
        }
      } catch (error) {
        toast.error('Failed to load SMTP configs');
      }
    };

  useEffect(() => {
    if (token) {
      fetchHistory();
      fetchConfigs();
    }
  }, [token]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery) {
      fetchHistory();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/mail/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setHistory(data);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAIByGenerate = async () => {
    if (!mailData.subject) {
      toast.error('Please enter a topic or subject for AI generator');
      return;
    }
    setGenLoading(true);
    try {
      const res = await fetch('/api/admin/mail/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ subject: mailData.subject })
      });
      const data = await res.json();
      if (res.ok) {
        setMailData(prev => ({ ...prev, body: data.body }));
        toast.success('AI Draft Generated!');
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('AI Generation failed');
    } finally {
      setGenLoading(false);
    }
  };

  const handleProcessMail = async (status: 'SENT' | 'DRAFT') => {
    if (!selectedConfigId) {
      toast.error('Please select a sender email configurations');
      return;
    }

    // Validate TO field (required)
    if (toEmails.length === 0) {
      toast.error('Please enter at least one recipient (TO)');
      return;
    }

    if (!mailData.subject || !mailData.body) {
      toast.error('Please fill in subject and message content');
      return;
    }

    if (status === 'SENT') setSendLoading(true);
    else setSaveLoading(true);

    try {
      const res = await fetch('/api/admin/mail/send', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          to: toEmails,
          cc: ccEmails,
          bcc: bccEmails,
          subject: mailData.subject,
          body: mailData.body,
          status,
          configId: selectedConfigId === 'default' ? undefined : configs.find(c => c.email === selectedConfigId)?.id 
        })
      });
      
      if (res.ok) {
        toast.success(status === 'SENT' ? 'Email sent successfully!' : 'Draft saved!');
        setToEmails([]);
        setCcEmails([]);
        setBccEmails([]);
        setToInput('');
        setCcInput('');
        setBccInput('');
        setMailData({ to: '', cc: '', bcc: '', subject: '', body: '' });
        fetchHistory();
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Operation failed');
    } finally {
      setSendLoading(false);
      setSaveLoading(false);
    }
  };

  const reuseTemplate = (item: MailHistoryItem) => {
    setToEmails(parseEmails(item.to));
    setCcEmails(item.cc ? parseEmails(item.cc) : []);
    setBccEmails(item.bcc ? parseEmails(item.bcc) : []);
    setMailData({
      to: '',
      cc: '',
      bcc: '',
      subject: item.subject,
      body: item.body
    });
    toast.info('Template loaded in composer');
  };

  const handleReply = (item: MailHistoryItem) => {
    let replySubject = item.subject || '';
    if (replySubject && !/^(re|Re):\s*/i.test(replySubject)) {
      replySubject = `Re: ${replySubject}`;
    }

    setToEmails(parseEmails(item.to));
    setCcEmails(item.cc ? parseEmails(item.cc) : []);
    setBccEmails(item.bcc ? parseEmails(item.bcc) : []);
    setMailData({
      to: '',
      cc: '',
      bcc: '',
      subject: replySubject,
      body: '' // Keep email body clean/empty as requested
    });
    setSelectedMail(null);
    toast.info('Reply drafted in composer');
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="page-title">
            <h1 className="text-2xl md:text-3xl font-bold text-[#1e293b] tracking-tight">Mail Writing Tool</h1>
            <p className="text-xs md:text-sm text-[#64748b] mt-1">Compose professional emails manually or with AI assistance.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Mail Composer - 7/12 */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="border border-[#e2e8f0] shadow-[0_2px_12px_rgba(0,0,0,0.02)] bg-white rounded-[24px] overflow-hidden">
              <CardHeader className="bg-[#f8fafc] border-b border-[#e2e8f0]/60 px-8 py-6">
                <CardTitle className="text-xl font-extrabold text-[#1e293b] flex items-center gap-2">
                  <Mail className="w-5 h-5 text-indigo-501" />
                  Email Composer
                </CardTitle>
                <CardDescription>Draft your email below. Use AI for professional assistance.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6" ref={wrapperRef}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">Send From</Label>
                    <Select value={selectedConfigId} onValueChange={(val) => setSelectedConfigId(val || '')}>
                      <SelectTrigger className="rounded-xl border-[#e2e8f0] h-12 focus:ring-indigo-500/20">
                        <SelectValue placeholder="Select Sender">
                          {selectedConfigId}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {configs.map(config => (
                          <SelectItem key={config.id} value={config.email}>{config.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 relative">
                    <Label htmlFor="to" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">Recipient Address (TO) *</Label>
                    <div className="flex flex-wrap items-center gap-1.5 p-2 min-h-12 border border-[#e2e8f0] rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all bg-white">
                      {toEmails.map((email, idx) => (
                        <div key={idx} className="flex items-center bg-[#f1f5f9] rounded-lg px-2.5 py-1 text-xs border border-[#e2e8f0] max-w-[200px] shrink-0">
                          <span className="text-[#334155] font-semibold truncate mr-1.5">{email}</span>
                          <X className="w-3.5 h-3.5 text-[#94a3b8] hover:text-[#ef4444] cursor-pointer shrink-0" onClick={() => removeRecipient('to', email)} />
                        </div>
                      ))}
                      <input 
                        type="text" 
                        id="to"
                        placeholder={toEmails.length === 0 ? "recipient@example.com" : ""} 
                        className="flex-1 min-w-[120px] outline-none border-none text-sm py-1 px-1 text-[#1e293b] font-medium bg-transparent" 
                        value={toInput}
                        onChange={(e) => handleInputChange('to', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, 'to')}
                        onFocus={() => setActiveField('to')}
                        autoComplete="off"
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">Press Enter or select a suggestion to add. Click "X" to remove.</p>

                    {activeField === 'to' && (suggestions.length > 0 || isLoadingSuggestions) && (
                      <div className="absolute top-full left-0 w-full mt-1.5 max-h-[200px] overflow-y-auto bg-white border border-[#e2e8f0] shadow-xl rounded-xl z-[100] py-1">
                        {suggestions.map((c, i) => (
                          <div key={i} className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 ${highlightedIndex === i ? 'bg-indigo-50/70 text-indigo-700' : 'hover:bg-slate-50'}`} onMouseDown={() => addRecipient('to', c.email)}>
                            <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">{c.name.charAt(0)}</div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-[#1e293b] truncate">{c.name}</span>
                              <span className="text-[10px] text-slate-400 truncate">{c.email}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 relative">
                    <Label htmlFor="cc" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">CC (Optional)</Label>
                    <div className="flex flex-wrap items-center gap-1.5 p-2 min-h-12 border border-[#e2e8f0] rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all bg-white">
                      {ccEmails.map((email, idx) => (
                        <div key={idx} className="flex items-center bg-[#f1f5f9] rounded-lg px-2.5 py-1 text-xs border border-[#e2e8f0] max-w-[200px] shrink-0">
                          <span className="text-[#334155] font-semibold truncate mr-1.5">{email}</span>
                          <X className="w-3.5 h-3.5 text-[#94a3b8] hover:text-[#ef4444] cursor-pointer shrink-0" onClick={() => removeRecipient('cc', email)} />
                        </div>
                      ))}
                      <input 
                        type="text" 
                        id="cc"
                        placeholder={ccEmails.length === 0 ? "cc@example.com" : ""} 
                        className="flex-1 min-w-[120px] outline-none border-none text-sm py-1 px-1 text-[#1e293b] font-medium bg-transparent" 
                        value={ccInput}
                        onChange={(e) => handleInputChange('cc', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, 'cc')}
                        onFocus={() => setActiveField('cc')}
                        autoComplete="off"
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">Press Enter or select a suggestion to add.</p>

                    {activeField === 'cc' && (suggestions.length > 0 || isLoadingSuggestions) && (
                      <div className="absolute top-full left-0 w-full mt-1.5 max-h-[200px] overflow-y-auto bg-white border border-[#e2e8f0] shadow-xl rounded-xl z-[100] py-1">
                        {suggestions.map((c, i) => (
                          <div key={i} className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 ${highlightedIndex === i ? 'bg-indigo-50/70 text-indigo-700' : 'hover:bg-slate-50'}`} onMouseDown={() => addRecipient('cc', c.email)}>
                            <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">{c.name.charAt(0)}</div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-[#1e293b] truncate">{c.name}</span>
                              <span className="text-[10px] text-slate-400 truncate">{c.email}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 relative">
                    <Label htmlFor="bcc" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">BCC (Optional)</Label>
                    <div className="flex flex-wrap items-center gap-1.5 p-2 min-h-12 border border-[#e2e8f0] rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all bg-white">
                      {bccEmails.map((email, idx) => (
                        <div key={idx} className="flex items-center bg-[#f1f5f9] rounded-lg px-2.5 py-1 text-xs border border-[#e2e8f0] max-w-[200px] shrink-0">
                          <span className="text-[#334155] font-semibold truncate mr-1.5">{email}</span>
                          <X className="w-3.5 h-3.5 text-[#94a3b8] hover:text-[#ef4444] cursor-pointer shrink-0" onClick={() => removeRecipient('bcc', email)} />
                        </div>
                      ))}
                      <input 
                        type="text" 
                        id="bcc"
                        placeholder={bccEmails.length === 0 ? "bcc@example.com" : ""} 
                        className="flex-1 min-w-[120px] outline-none border-none text-sm py-1 px-1 text-[#1e293b] font-medium bg-transparent" 
                        value={bccInput}
                        onChange={(e) => handleInputChange('bcc', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, 'bcc')}
                        onFocus={() => setActiveField('bcc')}
                        autoComplete="off"
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">Press Enter or select a suggestion to add.</p>

                    {activeField === 'bcc' && (suggestions.length > 0 || isLoadingSuggestions) && (
                      <div className="absolute top-full left-0 w-full mt-1.5 max-h-[200px] overflow-y-auto bg-white border border-[#e2e8f0] shadow-xl rounded-xl z-[100] py-1">
                        {suggestions.map((c, i) => (
                          <div key={i} className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 ${highlightedIndex === i ? 'bg-indigo-50/70 text-indigo-700' : 'hover:bg-slate-50'}`} onMouseDown={() => addRecipient('bcc', c.email)}>
                            <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">{c.name.charAt(0)}</div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-[#1e293b] truncate">{c.name}</span>
                              <span className="text-[10px] text-slate-400 truncate">{c.email}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">Subject / Topic</Label>
                  <div className="flex gap-3">
                    <Input 
                      id="subject"
                      placeholder="e.g., Leave Approval Request"
                      value={mailData.subject}
                      onChange={(e) => setMailData({...mailData, subject: e.target.value})}
                      className="rounded-xl border-[#e2e8f0] h-12 focus:ring-indigo-500/20 flex-1"
                    />
                    <Button 
                      onClick={handleAIByGenerate}
                      disabled={genLoading}
                      variant="outline"
                      className="rounded-xl px-4 h-12 border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold gap-2 whitespace-nowrap"
                    >
                      {genLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      AI Draft
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body" className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider ml-1">Message Content</Label>
                  <Textarea 
                    id="body"
                    placeholder="Write your email here..."
                    className="min-h-[300px] rounded-xl border-[#e2e8f0] p-5 leading-relaxed focus:ring-indigo-500/20"
                    value={mailData.body}
                    onChange={(e) => setMailData({...mailData, body: e.target.value})}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                   <Button 
                    variant="ghost"
                    size="sm"
                    className="text-[#64748b] hover:text-[#1e293b]"
                    onClick={() => {
                      setToEmails([]);
                      setCcEmails([]);
                      setBccEmails([]);
                      setToInput('');
                      setCcInput('');
                      setBccInput('');
                      setMailData({ to: '', cc: '', bcc: '', subject: '', body: '' });
                    }}
                  >
                    Clear All
                  </Button>
                  
                  <div className="flex gap-3">
                    <Button 
                      variant="outline"
                      className="rounded-xl h-12 px-6 border-[#e2e8f0] hover:bg-slate-50 font-bold gap-2"
                      disabled={saveLoading || sendLoading}
                      onClick={() => handleProcessMail('DRAFT')}
                    >
                      {saveLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Draft
                    </Button>
                    <Button 
                      className="rounded-xl h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 font-bold gap-2"
                      disabled={sendLoading || saveLoading}
                      onClick={() => handleProcessMail('SENT')}
                    >
                      {sendLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send Mail
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mail History & Search - 5/12 */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border border-[#e2e8f0] shadow-[0_2px_12px_rgba(0,0,0,0.02)] bg-white rounded-[24px] h-full flex flex-col overflow-hidden">
               <CardHeader className="bg-white border-b border-[#e2e8f0]/60 px-8 py-6">
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-lg font-extrabold text-[#1e293b] flex items-center gap-2">
                    <History className="w-5 h-5 text-slate-400" />
                    Mail History
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => fetchHistory()} className="h-8 w-8 rounded-full">
                    <RefreshCw className="w-4 h-4 text-slate-400" />
                  </Button>
                </div>
                
                <form onSubmit={handleSearch} className="relative mt-4">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Search by recipient, subject..." 
                    className="pl-10 h-10 rounded-xl bg-slate-50 border-none text-sm placeholder:text-slate-400"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button type="submit" className="hidden">Search</button>
                </form>
              </CardHeader>
              
              <CardContent className="p-0 flex-1 overflow-auto max-h-[700px]">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                    <RefreshCw className="w-8 h-8 animate-spin opacity-20" />
                    <p className="text-sm font-medium">Loading history...</p>
                  </div>
                ) : history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                      <SearchIcon className="w-6 h-6 opacity-30" />
                    </div>
                    <p className="text-sm font-medium">No results found.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    <AnimatePresence mode="popLayout">
                      {history.map((item) => (
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
                              item.status === 'SENT' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                            )}>
                              {item.status}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {format(new Date(item.createdAt), 'MMM dd, HH:mm')}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-[#1e293b] group-hover:text-indigo-600 transition-colors line-clamp-1 truncate pr-6">
                            {item.subject}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                            <span className="font-bold text-slate-400 truncate max-w-[150px]">To:</span> {item.to}
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
        <DialogContent className="sm:max-w-[650px] bg-white rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="px-8 py-6 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-3 mb-2">
               <span className={cn(
                  "text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter",
                  selectedMail?.status === 'SENT' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                )}>
                  {selectedMail?.status}
                </span>
                <span className="text-xs text-slate-400">
                  {selectedMail && format(new Date(selectedMail.createdAt), 'eeee, MMMM dd, yyyy @ HH:mm')}
                </span>
            </div>
            <DialogTitle className="text-2xl font-black text-[#1e293b] leading-tight pr-8">
              {selectedMail?.subject}
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-8 space-y-6 max-h-[70vh] overflow-auto">
            <div className="flex items-center gap-2 p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
              <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-indigo-600 text-xs font-bold">
                {selectedMail?.to[0].toUpperCase()}
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">To</p>
                <p className="text-sm font-bold text-slate-700">{selectedMail?.to}</p>
              </div>
            </div>

            {selectedMail?.cc && selectedMail.cc.trim() && (
              <div className="flex items-start gap-2 p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                  CC
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CC</p>
                  <p className="text-sm font-bold text-slate-700 break-words">{selectedMail.cc}</p>
                </div>
              </div>
            )}

            {selectedMail?.bcc && selectedMail.bcc.trim() && (
              <div className="flex items-start gap-2 p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-purple-600 text-xs font-bold flex-shrink-0">
                  BCC
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">BCC</p>
                  <p className="text-sm font-bold text-slate-700 break-words">{selectedMail.bcc}</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-100 p-6 whitespace-pre-wrap text-[#334155] text-sm leading-relaxed shadow-sm">
                {selectedMail?.body}
            </div>
            
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
