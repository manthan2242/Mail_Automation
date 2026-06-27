'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input } from './input';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EmailAutocompleteProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onValueChange?: (value: string) => void;
  customDomains?: string[];
}

import { DEFAULT_DOMAINS } from '@/lib/constants';

export const EmailAutocomplete: React.FC<EmailAutocompleteProps> = ({
  onValueChange,
  customDomains = DEFAULT_DOMAINS,
  className,
  value: controlledValue,
  onChange,
  ...props
}) => {
  const [inputValue, setInputValue] = useState((controlledValue as string) || '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (controlledValue !== undefined) {
      setInputValue(controlledValue as string);
    }
  }, [controlledValue]);

  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string) => {
    if (!email) {
      setError(null);
      return;
    }
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) {
      setError('Invalid email format');
    } else {
      setError(null);
    }
  };

  useEffect(() => {
    if (controlledValue !== undefined) {
      setInputValue(controlledValue as string);
      validateEmail(controlledValue as string);
    }
  }, [controlledValue]);

  const getSuggestions = (value: string) => {
    if (!value || !value.includes('@')) {
      setSuggestions([]);
      return;
    }

    const [username, domainPart] = value.split('@');
    if (!username) {
      setSuggestions([]);
      return;
    }

    // Only suggest if they've started typing a domain or just hit @
    const matchedDomains = customDomains
      .filter((d) => d.startsWith(domainPart.toLowerCase()))
      .map((d) => `${username}@${d}`);

    // If perfectly matched one domain, maybe hide suggestions
    if (matchedDomains.length === 1 && matchedDomains[0] === value) {
      setSuggestions([]);
    } else {
      setSuggestions(matchedDomains);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (value.includes(',')) {
      toast.error('Comma (,) is not accepted in recipient fields');
      value = value.replace(/,/g, '');
    }
    setInputValue(value);
    validateEmail(value);
    onValueChange?.(value);
    // Create a modified event with the cleaned value to pass up
    const newEvent = {
      ...e,
      target: { ...e.target, value },
      currentTarget: { ...e.currentTarget, value }
    } as React.ChangeEvent<HTMLInputElement>;
    onChange?.(newEvent);
    getSuggestions(value);
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  const handleSelect = (email: string) => {
    setInputValue(email);
    validateEmail(email);
    onValueChange?.(email);
    setSuggestions([]);
    setIsOpen(false);
    
    // Trigger a fake change event for compatibility with forms
    const event = {
      target: { value: email, name: props.name },
      currentTarget: { value: email, name: props.name }
    } as React.ChangeEvent<HTMLInputElement>;
    onChange?.(event);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (selectedIndex >= 0) {
        e.preventDefault();
        handleSelect(suggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative group">
        <Input
          {...props}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue.includes('@') && setIsOpen(true)}
          className={cn(
            "pr-10 transition-all duration-200", 
            error ? "border-rose-500 focus-visible:ring-rose-500" : "focus-visible:ring-indigo-500",
            className
          )}
          autoComplete="off"
        />
        {error && (
          <div className="absolute -bottom-5 left-0 text-[10px] font-bold text-rose-500 uppercase tracking-tight">
            {error}
          </div>
        )}
      </div>
      
      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.98 }}
            className="absolute z-[100] w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden py-1"
          >
            {suggestions.map((suggestion, index) => {
              const [user, domain] = suggestion.split('@');
              const inputDomain = inputValue.split('@')[1] || '';
              
              return (
                <div
                  key={suggestion}
                  onClick={() => handleSelect(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "px-4 py-3 cursor-pointer text-sm transition-all flex items-center justify-between",
                    selectedIndex === index ? "bg-indigo-50 text-indigo-700 mx-1 rounded-xl" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-slate-400">{user}@</span>
                    <span className="text-slate-900 font-bold">{inputDomain}</span>
                    <span className="text-indigo-600 font-bold">{domain.slice(inputDomain.length)}</span>
                  </div>
                  {selectedIndex === index && (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-[0.1em]">Tab to select</span>
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

