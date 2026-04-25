import { GoogleGenAI } from "@google/genai";

import { AI_MODEL_NAME } from './constants';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

async function runWithRetry<T>(fn: () => Promise<T>, subject: string, fallback: string, retries: number = 5): Promise<T | string> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryable = error.message?.includes('high demand') || 
                           error.message?.includes('503') || 
                           error.message?.includes('429') ||
                           error.status === 503 ||
                           error.status === 429;
      
      if (isRetryable && i < retries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s, 8s, 16s
        console.warn(`[AI RETRY ${i + 1}/${retries}] Model busy, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      console.error(`[AI FINAL FAILURE] After ${i + 1} attempts: ${error.message}`);
      break;
    }
  }
  
  console.log(`[AI FALLBACK] Returning pre-defined template for: ${subject}`);
  return fallback;
}

export const generateEmailBody = async (subject: string, sourceEmail: string = 'the sender') => {
  if (!ai) {
    return `Dear Sir/Madam,\n\nI hope this message finds you well. I am writing to formally bring to your attention the matter regarding "${subject}".\n\nAs part of our ongoing commitment to maintaining smooth operations and transparent communication within the organization, I would like to request your kind consideration on this matter. I believe that addressing this promptly will contribute positively to our workflow and overall team efficiency.\n\nI have ensured that all necessary details pertaining to this request are in order. Should you require any additional documentation or clarification, please do not hesitate to reach out, and I will be happy to provide the same at the earliest convenience.\n\nI sincerely appreciate your time and attention to this matter. Looking forward to your favorable response.\n\nWarm regards,\n${sourceEmail}`;
  }

  const fallback = `Dear Sir/Madam,\n\nI hope this message finds you well. I am writing to formally bring to your attention the matter regarding "${subject}".\n\nAs part of our ongoing commitment to maintaining smooth operations and transparent communication within the organization, I would like to request your kind consideration on this matter. I believe that addressing this promptly will contribute positively to our workflow and overall team efficiency.\n\nI have ensured that all necessary details pertaining to this request are in order. Should you require any additional documentation or clarification, please do not hesitate to reach out, and I will be happy to provide the same at the earliest convenience.\n\nI sincerely appreciate your time and attention to this matter. Looking forward to your favorable response.\n\nWarm regards,\n${sourceEmail}`;

  return await runWithRetry(async () => {
    const prompt = `You are a professional corporate email writer. Write a SINGLE well-structured, formal business email body about: "${subject}".

STRICT RULES:
- Start with "Dear Sir/Madam," or "Dear Concerned Authority,"
- Write exactly 3 to 4 paragraphs (medium length, NOT too short, NOT too long)
- First paragraph: Polite greeting and clearly state the purpose of the email
- Middle paragraph(s): Provide relevant context, justification, or details about the request. Be specific and professional
- Final paragraph: Express gratitude, mention willingness to provide further info, and request a favorable response
- End with "Warm regards," or "Best regards," followed by a new line and "${sourceEmail}"
- Use formal, polished, corporate language throughout
- Do NOT include subject line, labels, placeholders like [Name], or multiple versions
- Output ONLY the email body text, nothing else`;

    const response = await ai.models.generateContent({
      model: AI_MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return response.text;
  }, subject, fallback);
};

export const generateAdminResponse = async (emailContent: string, action: 'approve' | 'reject' | 'info') => {
  const fallback = action === 'approve' 
    ? "I have reviewed your request and it has been approved. You may proceed."
    : action === 'reject' 
    ? "After careful review, your request has been declined at this time."
    : "Your request has been received. Please provide additional supporting details.";

  if (!ai) return fallback;

  return await runWithRetry(async () => {
    const prompt = `Provide ONLY ONE short professional response (max 2 sentences) for an admin who is ${action === 'approve' ? 'approving' : action === 'reject' ? 'rejecting' : 'asking for info about'} this email: "${emailContent.slice(0, 100)}". 
    Do not include preamble or multiple versions.`;

    const response = await ai.models.generateContent({
      model: AI_MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return response.text;
  }, action, fallback);
};
