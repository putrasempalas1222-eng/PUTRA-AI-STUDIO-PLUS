import { Attachment } from '../types';

export interface PutraAiResponse {
  text: string;
  imageBase64?: string;
  mode?: string;
}

const DEVICE_ID_KEY = 'putra_ai_studio_device_id';
const DEFAULT_API_BASE_URL = 'https://api-mzmdqh3n6a-uc.a.run.app';

function getChatApiUrl() {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
  return `${apiBaseUrl}/api/chat`;
}

function getDeviceId() {
  const existingId = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existingId) return existingId;

  const newId = `putra-web-${crypto.randomUUID()}`;
  window.localStorage.setItem(DEVICE_ID_KEY, newId);
  return newId;
}

class PutraAiService {
  public initChat() {
    // The Putra API is stateless from the frontend perspective.
  }

  public async sendMessage(text: string, attachments: Attachment[] = []): Promise<PutraAiResponse> {
    try {
      const response = await fetch(getChatApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: text.trim(),
          deviceId: getDeviceId(),
          attachments,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Putra API request failed.');
      }

      return {
        text: data?.text || 'I apologize, but I was unable to generate a response.',
        imageBase64: data?.imageBase64 || '',
        mode: data?.mode || '',
      };
    } catch (error) {
      console.error('Error communicating with Putra API:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get a response from Putra Ai. Please try again later.');
    }
  }

  public resetChat() {
    this.initChat();
  }
}

export const geminiService = new PutraAiService();
