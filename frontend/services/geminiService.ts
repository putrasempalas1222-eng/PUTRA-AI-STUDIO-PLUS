import { Attachment, Message } from '../types';

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

  private buildHistoryText(message: Pick<Message, 'role' | 'text' | 'attachments' | 'mode'>) {
    const text = message.text?.trim() || '';
    const imageAttachments = message.attachments?.filter((attachment) => attachment.mimeType.startsWith('image/')) || [];
    const fileAttachments = message.attachments?.filter((attachment) => !attachment.mimeType.startsWith('image/')) || [];

    if (message.role === 'user' && imageAttachments.length > 0) {
      const imageNames = imageAttachments.map((attachment) => attachment.name).join(', ');
      return [
        `[User mengirim gambar: ${imageNames}]`,
        text ? `Pertanyaan user tentang gambar: ${text}` : 'User meminta analisis gambar.',
      ].join('\n');
    }

    if (message.role === 'user' && fileAttachments.length > 0) {
      const fileNames = fileAttachments.map((attachment) => attachment.name).join(', ');
      return [
        `[User mengirim file: ${fileNames}]`,
        text ? `Pertanyaan user tentang file: ${text}` : 'User meminta analisis file.',
      ].join('\n');
    }

    if (message.role === 'model' && message.mode === 'vision' && text) {
      return `[Hasil analisis gambar oleh PUTRA AI PLUS]\n${text}`;
    }

    return text;
  }

  public async sendMessage(text: string, attachments: Attachment[] = [], history: Pick<Message, 'role' | 'text'>[] = []): Promise<PutraAiResponse> {
    try {
      const conversationHistory = history
        .map((message) => ({
          role: message.role,
          text: this.buildHistoryText(message),
        }))
        .filter((message) => message.text.trim())
        .slice(-16)
        .map((message) => ({
          role: message.role,
          text: message.text.trim().slice(0, 6000),
        }));

      const response = await fetch(getChatApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: text.trim(),
          deviceId: getDeviceId(),
          attachments,
          history: conversationHistory,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Permintaan ke Putra API gagal.');
      }

      return {
        text: data?.text || 'Maaf, saya belum bisa membuat balasan.',
        imageBase64: data?.imageBase64 || '',
        mode: data?.mode || '',
      };
    } catch (error) {
      console.error('Gagal berkomunikasi dengan Putra API:', error);
      throw new Error(error instanceof Error ? error.message : 'Gagal mendapatkan balasan dari PUTRA AI PLUS. Silakan coba lagi nanti.');
    }
  }

  public resetChat() {
    this.initChat();
  }
}

export const geminiService = new PutraAiService();
