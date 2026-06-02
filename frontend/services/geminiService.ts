import { Attachment, Message } from '../types';

export interface PutraAiResponse {
  text: string;
  imageBase64?: string;
  mode?: string;
  thinking?: string;
}

interface SendMessageCallbacks {
  onThinking?: (thinking: string) => void;
}

const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

const PRIMARY_OLLAMA_CHAT_URL =
  viteEnv.VITE_OLLAMA_CHAT_URL ||
  'https://rotunda-elderly-alto.ngrok-free.dev/api/chat';
const FALLBACK_CHAT_PROXY_URL =
  viteEnv.VITE_FALLBACK_CHAT_PROXY_URL ||
  'https://api-mzmdqh3n6a-uc.a.run.app/api/chat';
const OLLAMA_TEXT_MODEL = viteEnv.VITE_OLLAMA_TEXT_MODEL || 'putraai:v3';
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

function splitAiThinking(reply: string) {
  const cleanReply = normalizeWhitespace(reply);
  if (!cleanReply) return { text: '', thinking: '' };

  const thinkTagMatch = cleanReply.match(/<think>([\s\S]*?)<\/think>\s*([\s\S]*)/i);
  if (thinkTagMatch) {
    return {
      thinking: normalizeWhitespace(thinkTagMatch[1]),
      text: normalizeWhitespace(thinkTagMatch[2]),
    };
  }

  const answerMarker = cleanReply.match(/^(thinking\.{0,3}|pikiran\.{0,3}|proses\.{0,3})\s*([\s\S]*?)(?:\n\s*(?:jawaban|answer|final answer|final)\s*:\s*)([\s\S]*)$/i);
  if (answerMarker) {
    return {
      thinking: normalizeWhitespace(answerMarker[2]),
      text: normalizeWhitespace(answerMarker[3]),
    };
  }

  if (/^thinking\.{0,3}/i.test(cleanReply)) {
    const withoutMarker = normalizeWhitespace(cleanReply.replace(/^thinking\.{0,3}\s*/i, ''));
    const paragraphs = withoutMarker.split(/\n\s*\n/).map(normalizeWhitespace).filter(Boolean);

    if (paragraphs.length > 1) {
      return {
        thinking: paragraphs[0],
        text: paragraphs.slice(1).join('\n\n'),
      };
    }

    return {
      thinking: withoutMarker,
      text: 'Saya sedang menyusun jawaban. Jika jawaban utama belum muncul, coba kirim ulang pertanyaannya.',
    };
  }

  return { text: cleanReply, thinking: '' };
}

function getThinkingPreview(text: string) {
  const cleanText = normalizeWhitespace(text);
  if (cleanText.length <= 4000) return cleanText;
  return `${cleanText.slice(0, 4000).trim()}...`;
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
    const messages = history.slice(-10).map((message) => ({
      role: message.role === 'model' ? 'assistant' : 'user',
      content: normalizeWhitespace(message.text).slice(0, 2500),
    }));

    return [
      ...messages,
      {
        role: 'user',
        content: prompt,
      },
    ];
  }

  private parseOllamaLine(line: string) {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }

  private async readOllamaReply(response: Response, callbacks: SendMessageCallbacks = {}) {
    let fullText = '';
    let fullThinking = '';

    const consumeLine = (line: string) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;

      const data = this.parseOllamaLine(cleanLine);
      if (data) {
        fullThinking += data?.message?.thinking || data?.thinking || '';
        fullText += data?.message?.content || data?.response || '';
        if (fullThinking && !fullText) callbacks.onThinking?.(getThinkingPreview(fullThinking));
      } else {
        fullText += cleanLine;
      }
    };

    if (!response.body) {
      const rawBody = await response.text();
      for (const line of rawBody.split('\n')) consumeLine(line);
      return {
        text: normalizeWhitespace(fullText),
        thinking: normalizeWhitespace(fullThinking),
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let pending = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() || '';
      for (const line of lines) consumeLine(line);
    }

    pending += decoder.decode();
    consumeLine(pending);

    return {
      text: normalizeWhitespace(fullText),
      thinking: normalizeWhitespace(fullThinking),
    };
  }

  private async sendToOllama(
    prompt: string,
    attachments: Attachment[],
    history: ReturnType<PutraAiService['toConversationHistory']>,
    callbacks: SendMessageCallbacks = {},
  ) {
    const imageAttachment = attachments.find((attachment) => attachment.mimeType.startsWith('image/') && attachment.data);
    const isVision = Boolean(imageAttachment);
    const content = normalizeWhitespace(prompt) || (isVision ? 'Analisis gambar ini.' : '');

    const response = await fetch(PRIMARY_OLLAMA_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: isVision ? OLLAMA_VISION_MODEL : OLLAMA_TEXT_MODEL,
        messages: isVision
          ? [
              ...this.toOllamaMessages('', history).filter((message) => message.content),
              {
                role: 'user',
                content,
                images: [imageAttachment?.data],
              },
            ]
          : this.toOllamaMessages(content, history),
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cloudflare/Ollama gagal: ${response.status}`);
    }

    const reply = await this.readOllamaReply(response, callbacks);
    if (!reply.text) {
      throw new Error('Cloudflare/Ollama tidak mengirim balasan.');
    }
    const parsedReply = splitAiThinking(reply.text);

    return {
      text: parsedReply.text || reply.text,
      thinking: reply.thinking || parsedReply.thinking,
      mode: isVision ? 'vision' : 'text',
    };
  }

  private async sendToFallbackApi(prompt: string, attachments: Attachment[], history: ReturnType<PutraAiService['toConversationHistory']>) {
    const hasImage = attachments.some((attachment) => attachment.mimeType.startsWith('image/'));

    const response = await fetch(FALLBACK_CHAT_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt || (hasImage ? 'Analisis gambar ini.' : ''),
        model: 'PutraAi-V1',
        attachments,
        history,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || data?.error || `Fallback API gagal: ${response.status}`);
    }

    const reply = normalizeWhitespace(data?.text || data?.content || extractFallbackText(data));
    if (!reply) {
      throw new Error('Fallback API tidak mengirim balasan.');
    }

    return {
      text: reply,
      thinking: '',
      mode: hasImage ? 'vision' : 'text',
    };
  }

  public async sendMessage(
    text: string,
    attachments: Attachment[] = [],
    history: Pick<Message, 'role' | 'text' | 'attachments' | 'mode'>[] = [],
    callbacks: SendMessageCallbacks = {},
  ): Promise<PutraAiResponse> {
    const conversationHistory = this.toConversationHistory(history);

    try {
      const primaryResponse = await this.sendToOllama(text.trim(), attachments, conversationHistory, callbacks);
      return {
        text: primaryResponse.text,
        thinking: primaryResponse.thinking,
        imageBase64: '',
        mode: primaryResponse.mode,
      };
    } catch (primaryError) {
      console.warn('Cloudflare/Ollama gagal, fallback ke PutraAi-V1:', primaryError);

      try {
        const fallbackResponse = await this.sendToFallbackApi(text.trim(), attachments, conversationHistory);
        return {
          text: fallbackResponse.text,
          thinking: fallbackResponse.thinking,
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
