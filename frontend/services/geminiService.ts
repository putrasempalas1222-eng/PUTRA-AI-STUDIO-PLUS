import { Attachment, Message } from '../types';

export interface PutraAiResponse {
  text: string;
  imageBase64?: string;
  mode?: string;
}

const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

const PRIMARY_OLLAMA_CHAT_URL =
  viteEnv.VITE_OLLAMA_CHAT_URL ||
  'https://hostel-schema-forest-remains.trycloudflare.com/api/chat';
const FALLBACK_TEXT_API_URL =
  viteEnv.VITE_PUTRA_AI_V1_API_URL ||
  'https://us-central1-conquer-apps-2ad61.cloudfunctions.net/prod/api.live';
const OLLAMA_TEXT_MODEL = viteEnv.VITE_OLLAMA_TEXT_MODEL || 'qwen2.5:3b';
const OLLAMA_VISION_MODEL = viteEnv.VITE_OLLAMA_VISION_MODEL || 'llava:7b';

function normalizeWhitespace(text: string) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getUserFacingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalizedMessage = message.toLowerCase();

  if (
    message.includes('4006') ||
    normalizedMessage.includes('daily free allocation') ||
    normalizedMessage.includes('10,000 neurons') ||
    normalizedMessage.includes('workers paid plan')
  ) {
    return 'PUTRA AI PLUS sedang maintenance. Silakan coba lagi beberapa saat nanti.';
  }

  return message || 'Gagal mendapatkan balasan dari PUTRA AI PLUS. Silakan coba lagi nanti.';
}

function extractFallbackText(data: any) {
  return normalizeWhitespace(
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    data?.response ||
    data?.reply ||
    data?.text ||
    data?.message ||
    data?.answer ||
    '',
  );
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

  private toConversationHistory(history: Pick<Message, 'role' | 'text' | 'attachments' | 'mode'>[] = []) {
    return history
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
  }

  private toOllamaMessages(prompt: string, history: ReturnType<PutraAiService['toConversationHistory']>) {
    const messages = history.slice(-8).map((message) => ({
      role: message.role === 'model' ? 'assistant' : 'user',
      content: normalizeWhitespace(message.text).slice(0, 4000),
    }));

    return [
      {
        role: 'system',
        content: [
          'Kamu adalah Putra AI Plus.',
          'Jawab dengan bahasa yang sama seperti pesan terbaru user.',
          'Gunakan riwayat percakapan agar jawaban nyambung.',
          'Jangan menyebut bahwa kamu asisten umum.',
        ].join(' '),
      },
      ...messages,
      {
        role: 'user',
        content: prompt,
      },
    ];
  }

  private async readOllamaReply(response: Response) {
    const rawBody = await response.text();
    let fullText = '';

    for (const line of rawBody.split('\n')) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;

      try {
        const data = JSON.parse(cleanLine);
        fullText += data?.message?.content || data?.response || '';
      } catch {
        fullText += cleanLine;
      }
    }

    return normalizeWhitespace(fullText);
  }

  private async sendToOllama(prompt: string, attachments: Attachment[], history: ReturnType<PutraAiService['toConversationHistory']>) {
    const imageAttachment = attachments.find((attachment) => attachment.mimeType.startsWith('image/') && attachment.data);
    const isVision = Boolean(imageAttachment);
    const content = isVision
      ? [
          normalizeWhitespace(prompt) || 'Analisis gambar ini secara detail.',
          'Jawab sesuai bahasa pertanyaan user.',
          'Jelaskan hanya berdasarkan gambar yang terlihat.',
          'Jika ada teks di gambar, sebutkan teksnya.',
        ].join('\n')
      : normalizeWhitespace(prompt);

    const response = await fetch(PRIMARY_OLLAMA_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: isVision ? OLLAMA_VISION_MODEL : OLLAMA_TEXT_MODEL,
        messages: isVision
          ? [
              {
                role: 'user',
                content,
                images: [imageAttachment?.data],
              },
            ]
          : this.toOllamaMessages(content, history),
        stream: true,
        options: {
          temperature: isVision ? 0.2 : 0.3,
          num_predict: isVision ? 420 : 512,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Cloudflare/Ollama gagal: ${response.status}`);
    }

    const reply = await this.readOllamaReply(response);
    if (!reply) {
      throw new Error('Cloudflare/Ollama tidak mengirim balasan.');
    }

    return {
      text: reply,
      mode: isVision ? 'vision' : 'text',
    };
  }

  private async sendToFallbackApi(prompt: string, attachments: Attachment[], history: ReturnType<PutraAiService['toConversationHistory']>) {
    const hasImage = attachments.some((attachment) => attachment.mimeType.startsWith('image/'));
    const conversationContext = history
      .map((message) => `${message.role === 'model' ? 'PUTRA AI PLUS' : 'User'}: ${message.text}`)
      .join('\n');
    const finalPrompt = normalizeWhitespace(`
Kamu adalah Putra AI Plus.
Jawab dengan bahasa yang sama seperti pesan terbaru user.
Gunakan riwayat percakapan agar jawaban tetap nyambung.

${conversationContext ? `RIWAYAT:\n${conversationContext}\n` : ''}
${hasImage ? 'Catatan: user mengirim gambar, tetapi layanan analisis gambar utama sedang tidak terhubung. Jawab berdasarkan pertanyaan user dan konteks yang tersedia, lalu minta user mengirim ulang jika detail gambar wajib dibaca.\n' : ''}
PESAN TERBARU USER:
${prompt || (hasImage ? 'Analisis gambar ini.' : '')}
`);

    const response = await fetch(FALLBACK_TEXT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        n: 1,
        prompt: finalPrompt,
        temperature: 0.8,
        top_p: 0.9,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || data?.error || `Fallback API gagal: ${response.status}`);
    }

    const reply = extractFallbackText(data);
    if (!reply) {
      throw new Error('Fallback API tidak mengirim balasan.');
    }

    return {
      text: reply,
      mode: hasImage ? 'vision' : 'text',
    };
  }

  public async sendMessage(
    text: string,
    attachments: Attachment[] = [],
    history: Pick<Message, 'role' | 'text' | 'attachments' | 'mode'>[] = [],
  ): Promise<PutraAiResponse> {
    const conversationHistory = this.toConversationHistory(history);

    try {
      const primaryResponse = await this.sendToOllama(text.trim(), attachments, conversationHistory);
      return {
        text: primaryResponse.text,
        imageBase64: '',
        mode: primaryResponse.mode,
      };
    } catch (primaryError) {
      console.warn('Cloudflare/Ollama gagal, fallback ke PutraAi-V1:', primaryError);

      try {
        const fallbackResponse = await this.sendToFallbackApi(text.trim(), attachments, conversationHistory);
        return {
          text: fallbackResponse.text,
          imageBase64: '',
          mode: fallbackResponse.mode,
        };
      } catch (fallbackError) {
        console.error('Gagal berkomunikasi dengan Putra API:', fallbackError);
        throw new Error(getUserFacingError(fallbackError));
      }
    }
  }

  public resetChat() {
    this.initChat();
  }
}

export const geminiService = new PutraAiService();
