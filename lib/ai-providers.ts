import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';

type Provider = 'openai' | 'gemini' | 'groq' | 'claude' | 'openrouter';

const FALLBACK_BODY = (subject: string, sender: string) =>
  `Dear Sir/Madam,\n\nI hope this message finds you well. I am writing regarding "${subject}".\n\nAs part of our ongoing commitment to professional communication, I would like to request your kind attention to this matter. I believe that addressing this promptly will positively contribute to our workflow.\n\nI have ensured all necessary details are in order. Should you require any further information, please do not hesitate to contact me.\n\nThank you for your time and consideration.\n\nWarm regards,\n${sender}`;

function decryptKey(hashedKey: string, rawKey: string): boolean {
  const check = crypto.createHash('sha256').update(rawKey).digest('hex');
  return check === hashedKey;
}

async function callOpenAI(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'OpenAI error');
  return data.choices[0].message.content;
}

async function callGroq(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Groq error');
  return data.choices[0].message.content;
}

async function callClaude(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Claude error');
  return data.content[0].text;
}

async function callOpenRouter(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'mistralai/mistral-7b-instruct',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'OpenRouter error');
  return data.choices[0].message.content;
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });
  return response.text ?? '';
}

export async function generateWithProvider(
  provider: Provider,
  rawApiKey: string,
  subject: string,
  sourceEmail: string = 'the sender'
): Promise<string> {
  const prompt = `You are a professional corporate email writer. Write a SINGLE well-structured, formal business email body about: "${subject}".

STRICT RULES:
- Start with "Dear Sir/Madam," or "Dear Concerned Authority,"
- Write exactly 3 to 4 paragraphs (medium length, NOT too short, NOT too long)
- First paragraph: Polite greeting and clearly state the purpose
- Middle paragraph(s): Provide relevant context, justification, or details
- Final paragraph: Express gratitude, mention willingness to provide further info
- End with "Warm regards," followed by a new line and "${sourceEmail}"
- Use formal, polished, corporate language throughout
- Do NOT include subject line, labels, placeholders like [Name], or multiple versions
- Output ONLY the email body text, nothing else`;

  try {
    switch (provider) {
      case 'openai':     return await callOpenAI(rawApiKey, prompt);
      case 'groq':       return await callGroq(rawApiKey, prompt);
      case 'claude':     return await callClaude(rawApiKey, prompt);
      case 'openrouter': return await callOpenRouter(rawApiKey, prompt);
      case 'gemini':     return await callGemini(rawApiKey, prompt);
      default:           throw new Error('Unknown provider');
    }
  } catch (err: any) {
    console.error(`[AI_PROVIDER_ERROR] ${provider}:`, err.message);
    // Return fallback body instead of crashing
    return FALLBACK_BODY(subject, sourceEmail);
  }
}

export const PROVIDER_LABELS: Record<Provider, string> = {
  openai:      'OpenAI (GPT-4o Mini)',
  gemini:      'Google Gemini',
  groq:        'Groq (Llama 3.3)',
  claude:      'Anthropic Claude',
  openrouter:  'OpenRouter (Mistral)'
};

export const PROVIDER_KEYS = Object.keys(PROVIDER_LABELS) as Provider[];
