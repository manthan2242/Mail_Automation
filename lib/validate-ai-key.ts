import { GoogleGenAI } from '@google/genai';

type Provider = 'openai' | 'gemini' | 'groq' | 'claude' | 'openrouter';

/**
 * Format validation rules per provider.
 */
export const KEY_FORMAT_RULES: Record<Provider, { prefix: string; minLength: number; label: string }> = {
  openai:     { prefix: 'sk-',     minLength: 40, label: 'OpenAI' },
  gemini:     { prefix: 'AIza',    minLength: 35, label: 'Gemini' },
  groq:       { prefix: 'gsk_',    minLength: 30, label: 'Groq' },
  claude:     { prefix: 'sk-ant-', minLength: 40, label: 'Claude' },
  openrouter: { prefix: 'sk-or-',  minLength: 30, label: 'OpenRouter' },
};

/**
 * Validates API key format (prefix + length).
 * Returns null if valid, or an error message string if invalid.
 */
export function validateKeyFormat(provider: Provider, key: string): string | null {
  const trimmed = key.trim();

  // Block numeric-only, too short, or whitespace-only
  if (!trimmed || trimmed.length < 30) {
    return 'API key must be at least 30 characters long.';
  }
  if (/^\d+$/.test(trimmed)) {
    return 'API key cannot be numeric-only.';
  }
  if (/^[a-zA-Z]{1,10}$/.test(trimmed)) {
    return 'This does not look like a valid API key.';
  }

  const rule = KEY_FORMAT_RULES[provider];
  if (!rule) return 'Unknown provider.';

  if (!trimmed.startsWith(rule.prefix)) {
    return `${rule.label} keys must start with "${rule.prefix}".`;
  }
  if (trimmed.length < rule.minLength) {
    return `${rule.label} keys must be at least ${rule.minLength} characters.`;
  }

  return null; // valid
}

/**
 * Makes a real test API call to verify the key works.
 * Returns { valid: true } or { valid: false, error: string }.
 */
export async function verifyKeyWithProvider(
  provider: Provider,
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    switch (provider) {
      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        if (res.ok) return { valid: true };
        const data = await res.json().catch(() => ({}));
        return { valid: false, error: data?.error?.message || `OpenAI returned ${res.status}` };
      }

      case 'gemini': {
        const ai = new GoogleGenAI({ apiKey });
        await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }]
        });
        return { valid: true };
      }

      case 'groq': {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        if (res.ok) return { valid: true };
        const data = await res.json().catch(() => ({}));
        return { valid: false, error: data?.error?.message || `Groq returned ${res.status}` };
      }

      case 'claude': {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 5,
            messages: [{ role: 'user', content: 'Say OK' }]
          })
        });
        if (res.ok) return { valid: true };
        const data = await res.json().catch(() => ({}));
        return { valid: false, error: data?.error?.message || `Claude returned ${res.status}` };
      }

      case 'openrouter': {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        if (res.ok) return { valid: true };
        const data = await res.json().catch(() => ({}));
        return { valid: false, error: data?.error?.message || `OpenRouter returned ${res.status}` };
      }

      default:
        return { valid: false, error: 'Unknown provider' };
    }
  } catch (err: any) {
    return { valid: false, error: err.message || 'Verification failed' };
  }
}
