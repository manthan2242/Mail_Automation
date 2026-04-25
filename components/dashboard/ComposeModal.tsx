'use client';
import { useState, useEffect, useRef } from 'react';
import { Minus, Maximize2, X, Paperclip, Link as LinkIcon, Smile, Image as ImageIcon, Trash2, Send, Triangle, Lock, PenTool, Sparkles, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Undo, Redo, ChevronDown, HardDrive, File as FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Contact {
  email: string;
  name: string;
}

export default function ComposeModal({ onClose }: { onClose: () => void }) {
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [toInput, setToInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  
  const [isMinimized, setIsMinimized] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeField, setActiveField] = useState<'to' | 'cc' | 'bcc' | null>(null);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<Contact[]>([]);

  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout|null>(null);
  
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showSendOptions, setShowSendOptions] = useState(false);
  
  const [identities, setIdentities] = useState<{id: string, email: string}[]>([]);
  const [selectedIdentity, setSelectedIdentity] = useState<string>('');
  
  const [isConfidential, setIsConfidential] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [showConfidentialModal, setShowConfidentialModal] = useState(false);
  const [confidentialExpiry, setConfidentialExpiry] = useState('Expires in 1 week');
  const [confidentialPasscode, setConfidentialPasscode] = useState('none');

  const { token, user } = useAuth();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchContacts = async () => {
      if (!token) return;
      try {
        const res = await fetch('/api/employee/contacts', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (Array.isArray(data)) setContacts(data);
      } catch (err) {}
    };

    const fetchIdentities = async () => {
      if (!token || !user) return;
      try {
        const endpoint = user.role === 'admin' ? '/api/admin/email-configs' : '/api/employee/assigned-emails';
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setIdentities(data);
          if (data.length > 0) setSelectedIdentity(data[0].email);
        }
      } catch (err) {} finally {
        setLoading(false);
      }
    };

    fetchContacts();
    fetchIdentities();
  }, [token, user]);

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
    if (field === 'to') setToInput(val);
    if (field === 'cc') setCcInput(val);
    if (field === 'bcc') setBccInput(val);
    setActiveField(field);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchSuggestions(val), 300);
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

  const addRecipient = (field: 'to'|'cc'|'bcc', email: string) => {
    if (!email.trim() || !email.includes('@')) return;
    if (field === 'to' && !to.includes(email)) setTo([...to, email]);
    if (field === 'cc' && !cc.includes(email)) setCc([...cc, email]);
    if (field === 'bcc' && !bcc.includes(email)) setBcc([...bcc, email]);
    if (field === 'to') setToInput('');
    if (field === 'cc') setCcInput('');
    if (field === 'bcc') setBccInput('');
    setActiveField(null);
    setSuggestions([]);
    setHighlightedIndex(-1);
  };

  const removeRecipient = (field: 'to'|'cc'|'bcc', email: string) => {
    if (field === 'to') setTo(to.filter(e => e !== email));
    if (field === 'cc') setCc(cc.filter(e => e !== email));
    if (field === 'bcc') setBcc(bcc.filter(e => e !== email));
  };

  const executeCommand = (cmd: string, val: string | undefined = undefined) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setAttachments([...attachments, ...Array.from(e.target.files)]);
  };

  const removeAttachment = (idx: number) => {
    setAttachments(attachments.filter((_, i) => i !== idx));
  };

  const handleGenerate = async () => {
    if (!subject) {
      toast.error('Please enter a subject first');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic: subject }),
      });
      const data = await res.json();
      if (res.ok) {
        if (editorRef.current) {
          editorRef.current.innerHTML = data.body.replace(/\n/g, '<br/>');
          setBodyHtml(editorRef.current.innerHTML);
        }
        toast.success('AI Draft generated!');
      }
    } catch (e) {
      toast.error('AI Draft failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    const finalBody = editorRef.current?.innerHTML || '';
    if (to.length === 0 || !subject || !finalBody.trim()) {
      toast.error('To, Subject, and Body are required');
      return;
    }
    setSending(true);
    try {
      const isAdmin = user?.role === 'admin';
      const endpoint = isAdmin ? '/api/admin/send-email' : '/api/employee/emails';
      const configId = identities.find(i => i.email === selectedIdentity)?.id;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          to: to.join(','), 
          subject, 
          body: finalBody,
          fromEmail: selectedIdentity,
          configId: isAdmin ? configId : undefined
        }),
      });
      if (res.ok) {
        toast.success(isAdmin ? 'Email sent!' : 'Sent for approval');
        onClose();
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to send');
    } finally {
      setSending(false);
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-0 right-0 sm:right-16 w-full sm:w-[300px] bg-white rounded-t-lg shadow-2xl z-[100] flex items-center justify-between px-4 py-3 cursor-pointer border border-gray-200" onClick={() => setIsMinimized(false)}>
        <span className="font-semibold text-sm text-gray-800">New Message</span>
        <div className="flex items-center gap-3 text-gray-500">
          <Maximize2 className="w-4 h-4 hover:text-gray-800" />
          <X className="w-4 h-4 hover:text-gray-800" onClick={(e) => { e.stopPropagation(); onClose(); }} />
        </div>
      </div>
    );
  }

  const renderChips = (field: 'to'|'cc'|'bcc', items: string[]) => {
    return items.map((email, idx) => (
      <div key={idx} className="flex items-center bg-gray-100 rounded-full px-2 py-0.5 text-xs sm:text-sm mr-1 mb-1 border border-gray-200">
        <span className="text-gray-800 mr-1.5 truncate max-w-[150px]">{email}</span>
        <X className="w-3 h-3 text-gray-500 hover:text-gray-900 cursor-pointer" onClick={() => removeRecipient(field, email)} />
      </div>
    ));
  };

  return (
    <div className="fixed inset-0 sm:inset-x-auto sm:inset-y-auto sm:bottom-0 sm:right-16 w-full sm:w-[600px] sm:h-[650px] z-[100] bg-white sm:rounded-t-xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
      {/* Header - always pinned to top, X always visible */}
      <div className="bg-[#f2f6fc] px-4 py-3 flex justify-between items-center text-sm border-b border-gray-200 shrink-0">
        <span className="font-semibold text-gray-800">New Message</span>
        <div className="flex items-center gap-3 text-gray-500">
          <Minus className="w-4 h-4 cursor-pointer hover:text-gray-900 hidden sm:block" onClick={() => setIsMinimized(true)} />
          <Maximize2 className="w-4 h-4 cursor-pointer hover:text-gray-900 hidden sm:block" />
          <X className="w-6 h-6 sm:w-4 sm:h-4 cursor-pointer hover:text-gray-900 text-gray-700" onClick={onClose} />
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto" ref={wrapperRef}>
        {/* To Field */}
        <div className="relative border-b border-gray-100 px-4 py-2 flex flex-wrap items-center min-h-[46px]">
          <span className="text-gray-500 text-sm font-medium w-8 shrink-0">To</span>
          <div className="flex flex-1 flex-wrap items-center overflow-hidden">
            {renderChips('to', to)}
            <input 
              type="text" 
              className="flex-1 min-w-[100px] outline-none text-sm sm:text-base py-1 font-medium text-gray-800 bg-transparent" 
              value={toInput}
              onChange={(e) => handleInputChange('to', e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, 'to')}
              onFocus={() => setActiveField('to')}
            />
          </div>
          <div className="text-gray-400 text-xs sm:text-sm ml-2 font-medium space-x-2 shrink-0">
            <span onClick={() => setShowCc(!showCc)} className="cursor-pointer hover:text-gray-800">Cc</span>
            <span onClick={() => setShowBcc(!showBcc)} className="cursor-pointer hover:text-gray-800">Bcc</span>
          </div>

          {activeField === 'to' && (suggestions.length > 0 || isLoadingSuggestions) && (
            <div className="absolute top-full left-0 w-full max-h-[250px] overflow-y-auto bg-white border border-gray-200 shadow-2xl rounded-b-lg z-[110] py-1">
              {suggestions.map((c, i) => (
                <div key={i} className={`px-4 py-2 cursor-pointer flex items-center gap-3 ${highlightedIndex === i ? 'bg-blue-50' : 'hover:bg-gray-50'}`} onMouseDown={() => addRecipient('to', c.email)}>
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">{c.name.charAt(0)}</div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs sm:text-sm font-semibold truncate">{c.name}</span>
                    <span className="text-[10px] sm:text-xs text-gray-500 truncate">{c.email}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CC & BCC Fields */}
        {showCc && (
           <div className="relative border-b border-gray-100 px-4 py-2 flex flex-wrap items-center">
            <span className="text-gray-500 text-sm font-medium w-8">Cc</span>
            <div className="flex flex-1 flex-wrap items-center">
              {renderChips('cc', cc)}
              <input type="text" className="flex-1 min-w-[100px] outline-none text-sm py-1 font-medium" value={ccInput} onChange={(e) => handleInputChange('cc', e.target.value)} onFocus={() => setActiveField('cc')} />
            </div>
           </div>
        )}
        {showBcc && (
           <div className="relative border-b border-gray-100 px-4 py-2 flex flex-wrap items-center">
            <span className="text-gray-500 text-sm font-medium w-8">Bcc</span>
            <div className="flex flex-1 flex-wrap items-center">
              {renderChips('bcc', bcc)}
              <input type="text" className="flex-1 min-w-[100px] outline-none text-sm py-1 font-medium" value={bccInput} onChange={(e) => handleInputChange('bcc', e.target.value)} onFocus={() => setActiveField('bcc')} />
            </div>
           </div>
        )}

        <div className="border-b border-gray-100 px-4 py-2 shrink-0">
          <input type="text" className="w-full outline-none text-sm sm:text-base py-1 font-medium text-gray-800" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>

        {/* Formatting Toolbar - Added horizontal scroll for mobile */}
        {showToolbar && (
          <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
            <button onClick={() => executeCommand('undo')} className="p-1.5 hover:bg-gray-200 rounded"><Undo className="w-4 h-4" /></button>
            <button onClick={() => executeCommand('bold')} className="p-1.5 hover:bg-gray-200 rounded"><Bold className="w-4 h-4" /></button>
            <button onClick={() => executeCommand('italic')} className="p-1.5 hover:bg-gray-200 rounded"><Italic className="w-4 h-4" /></button>
            <button onClick={() => executeCommand('underline')} className="p-1.5 hover:bg-gray-200 rounded"><Underline className="w-4 h-4" /></button>
            <div className="w-[1px] h-4 bg-gray-300 mx-1" />
            <button onClick={() => executeCommand('justifyLeft')} className="p-1.5 hover:bg-gray-200 rounded"><AlignLeft className="w-4 h-4" /></button>
            <button onClick={() => executeCommand('insertUnorderedList')} className="p-1.5 hover:bg-gray-200 rounded"><List className="w-4 h-4" /></button>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0">
          <div ref={editorRef} className="flex-1 px-4 py-3 outline-none text-sm sm:text-base text-gray-800 leading-relaxed overflow-y-auto" contentEditable onInput={(e) => setBodyHtml(e.currentTarget.innerHTML)} />
          
          <div className="px-4 pb-2">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center bg-gray-100 border border-gray-200 rounded-md px-2 py-1 text-[10px] text-gray-700">
                    <span className="max-w-[100px] truncate">{file.name}</span>
                    <X className="w-3 h-3 ml-1 cursor-pointer hover:text-red-500" onClick={() => removeAttachment(idx)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Actions - Optimized for Mobile, no extra bottom gap */}
      <div className="px-3 sm:px-4 py-3 bg-white border-t border-gray-100 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="relative flex items-center h-9">
              <button className="bg-[#0b57d0] hover:bg-[#084298] text-white rounded-l-full px-3 sm:px-5 h-9 font-medium text-xs sm:text-sm flex items-center" onClick={handleSend} disabled={sending}>
                {sending ? '...' : 'Send'}
              </button>
              <button className="bg-[#0b57d0] hover:bg-[#084298] text-white rounded-r-full px-1.5 h-9 border-l border-white/20" onClick={() => setShowSendOptions(!showSendOptions)}>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            
            {/* Scrollable icon list for small screens */}
            <div className="flex items-center gap-2 sm:gap-4 ml-1 sm:ml-4 overflow-x-auto no-scrollbar max-w-[150px] sm:max-w-none text-gray-500">
              <button onClick={() => setShowToolbar(!showToolbar)} className={`p-1.5 rounded-full ${showToolbar ? 'bg-blue-100 text-blue-800' : ''}`}><span className="font-serif font-bold">Aa</span></button>
              <Paperclip className="w-5 h-5 cursor-pointer shrink-0" onClick={() => fileInputRef.current?.click()} />
              <Smile className="w-5 h-5 cursor-pointer shrink-0" onClick={() => setShowEmojiPicker(!showEmojiPicker)} />
              <ImageIcon className="w-5 h-5 cursor-pointer shrink-0" onClick={() => fileInputRef.current?.click()} />
              <Lock className={`w-5 h-5 cursor-pointer shrink-0 ${isConfidential ? 'text-indigo-600' : ''}`} onClick={() => setShowConfidentialModal(true)} />
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            <Button className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 h-9 px-2 sm:px-3 text-[10px] sm:text-xs font-bold rounded-full shadow-none" onClick={handleGenerate} disabled={generating || !subject}>
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1" />
              AI Draft
            </Button>
            <Trash2 className="w-5 h-5 text-gray-400 hover:text-red-500 cursor-pointer ml-1" onClick={onClose} />
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />

      {/* Modals - Simplified for responsiveness */}
      {showConfidentialModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[450px] rounded-2xl p-6">
            <h2 className="text-xl font-medium mb-4">Confidential mode</h2>
            <p className="text-sm text-gray-600 mb-6">Recipients won't have the option to forward, copy, print, or download this email.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowConfidentialModal(false)}>Cancel</Button>
              <Button className="bg-[#0b57d0]" onClick={() => { setIsConfidential(true); setShowConfidentialModal(false); }}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}