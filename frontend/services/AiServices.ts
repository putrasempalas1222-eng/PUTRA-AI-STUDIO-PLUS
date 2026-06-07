import { Attachment, Message } from '../types';

export interface PutraAiResponse {
  text: string;
  imageBase64?: string;
  mode?: string;
  thinking?: string;
}

interface SendMessageCallbacks {
  onThinking?: (thinking: string) => void;
  onContent?: (content: string) => void;
}

const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

const PRIMARY_OLLAMA_CHAT_URL =
  viteEnv.VITE_OLLAMA_CHAT_URL ||
  'https://rotunda-elderly-alto.ngrok-free.dev/api/chat';
const FALLBACK_CHAT_PROXY_URL =
  viteEnv.VITE_FALLBACK_CHAT_PROXY_URL ||
  'https://api-mzmdqh3n6a-uc.a.run.app/api/chat';
const OLLAMA_TEXT_MODEL = (viteEnv.VITE_OLLAMA_TEXT_MODEL || 'deepseek-r1:8b').trim() || 'deepseek-r1:8b';
const OLLAMA_VISION_MODEL = (viteEnv.VITE_OLLAMA_VISION_MODEL || 'gemma3:4b').trim() || 'gemma3:4b';
const MAX_OLLAMA_IMAGE_BYTES = 3 * 1024 * 1024;
const SUPPORTED_OLLAMA_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

function normalizeWhitespace(text: string) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function isLikelyIndonesianText(text: string) {
  const normalized = ` ${String(text || '').toLowerCase()} `;
  return /\b(saya|anda|kamu|yang|dan|atau|dengan|untuk|dari|ini|itu|dapat|bisa|membantu|pertanyaan|jawaban|bahasa|teks|gambar|file)\b/.test(normalized);
}

function stripDuplicateEnglishTail(text: string) {
  const cleanText = normalizeWhitespace(text);
  if (!isLikelyIndonesianText(cleanText)) return cleanText;

  const englishTailPatterns = [
    /\n\s*What can I do\s*\??[\s\S]*$/i,
    /\n\s*As Putra AI Studio[\s\S]*$/i,
    /\n\s*As PUTRA AI PLUS[\s\S]*$/i,
    /\n\s*Here are some things I can do[\s\S]*$/i,
    /\n\s*How can I help(?: you)?\s*\??[\s\S]*$/i,
    /\n\s*What would you like(?: me)? to do\s*\??[\s\S]*$/i,
    /\n\s*I can help you[\s\S]*$/i,
  ];

  return englishTailPatterns.reduce((result, pattern) => result.replace(pattern, ''), cleanText).trim();
}
function sanitizeModelIdentity(text: string) {
  return stripDuplicateEnglishTail(normalizeWhitespace(text))
    .replace(/\bDeepSeek(?:\s*AI)?\b/gi, 'Putra AI Studio')
    .replace(/\bdeepseek-r1(?::\d+b)?\b/gi, 'Putra AI Studio')
    .replace(/\bQwen(?:\s*AI)?\b/gi, 'Putra AI Studio')
    .replace(/\bLlama(?:\s*AI)?\b/gi, 'Putra AI Studio')
    .replace(/\bGemini(?:\s*AI)?\b/gi, 'Putra AI Studio')
    .replace(/\bOpenAI\b/gi, 'Putra AI Studio')
    .replace(/\bChatGPT\b/gi, 'Putra AI Studio')
    .replace(/\bClaude\b/gi, 'Putra AI Studio')
    .replace(/\bMistral\b/gi, 'Putra AI Studio')
    .replace(/\bOllama\b/gi, 'Putra AI Studio');
}
function toRawBase64(data?: string) {
  return String(data || '').replace(/^data:image\/\w+;base64,/, '').replace(/^data:[^,]+,/, '');
}

function getBase64ByteSize(base64: string) {
  const cleanBase64 = toRawBase64(base64);
  const padding = cleanBase64.endsWith('==') ? 2 : cleanBase64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((cleanBase64.length * 3) / 4) - padding);
}

function validateOllamaImageAttachment(attachment?: Attachment) {
  if (!attachment?.data) {
    throw new Error('Gambar belum terbaca. Coba upload ulang gambar.');
  }

  if (!SUPPORTED_OLLAMA_IMAGE_TYPES.has(attachment.mimeType)) {
    throw new Error('Format gambar harus PNG, JPG, JPEG, atau WEBP.');
  }

  const rawBase64 = toRawBase64(attachment.data);
  if (!rawBase64) {
    throw new Error('Data gambar kosong. Coba upload ulang gambar.');
  }

  const imageSize = attachment.size || getBase64ByteSize(rawBase64);
  if (imageSize > MAX_OLLAMA_IMAGE_BYTES) {
    throw new Error('Ukuran gambar maksimal 3MB. Kompres gambar dulu lalu coba lagi.');
  }

  return rawBase64;
}

function isVisionInputError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return message.includes('format gambar') || message.includes('ukuran gambar') || message.includes('data gambar') || message.includes('gambar belum terbaca');
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

  if (
    normalizedMessage.includes('failed to fetch') ||
    normalizedMessage.includes('fetch failed') ||
    normalizedMessage.includes('econnrefused') ||
    normalizedMessage.includes('networkerror') ||
    normalizedMessage.includes('load failed')
  ) {
    return `FETCH_ERROR: Server sedang ada perbaikan. Detail: ${message || 'Koneksi ke server AI gagal.'}`;
  }

  if (
    normalizedMessage.includes('model') &&
    (normalizedMessage.includes('not found') || normalizedMessage.includes('pull') || normalizedMessage.includes('404'))
  ) {
    return `MODEL_NOT_READY: Server sedang ada perbaikan. Detail: ${message || 'Model AI belum tersedia di server.'}`;
  }

  if (normalizedMessage.includes('too large') || normalizedMessage.includes('payload') || normalizedMessage.includes('ukuran gambar')) {
    return `IMAGE_TOO_LARGE: Ukuran gambar terlalu besar. Detail: Maksimal 3MB untuk analisis gambar.`;
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
  return stripDuplicateEnglishTail(normalizeWhitespace(text));
}
function hasCjkText(text: string) {
  return /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/.test(text);
}

function isLikelyIndonesianPrompt(text: string) {
  const normalized = ` ${text.toLowerCase()} `;
  return /\b(apa|apakah|siapa|bagaimana|kenapa|mengapa|jelaskan|tolong|buatkan|perbaiki|gambar|file|saya|kamu|yang|dan|atau|dengan|untuk|dari|ini|itu)\b/.test(normalized);
}

function getThinkingPlaceholder(prompt: string) {
  return isLikelyIndonesianPrompt(prompt)
    ? 'Memahami permintaan dan menyiapkan jawaban...'
    : 'Understanding the request and preparing the answer...';
}

function getOllamaSystemPrompt(prompt: string) {
  const thinkingLanguage = isLikelyIndonesianPrompt(prompt) ? 'Indonesian' : 'English';
  return [
    'You are Putra AI Studio, also known as PUTRA AI PLUS.',
    `Use ${thinkingLanguage} for reasoning/thinking text.`,
    'Use exactly one final-answer language: the same language as the latest user message whenever it is clear.',
    'Do not repeat the same answer in another language. Do not append an English version after an Indonesian answer.',
    'Never mention DeepSeek, Qwen, Llama, Gemini, OpenAI, ChatGPT, Claude, Mistral, Ollama, or any underlying model/provider name.',
    'If asked about your model, say you are Putra AI Studio.',
    'Default to English for very short or unclear prompts.',
    'Never write reasoning/thinking in Chinese, Japanese, or Korean unless the latest user message itself is written in that language.',
    'Reason naturally as needed, then provide a detailed and useful final answer.',
    'As Putra AI Studio Pro, prefer complete, helpful, well-explained answers instead of overly short replies.'
  ].join(' ');
}


function getFastTextSystemPrompt(prompt: string) {
  const finalLanguage = isLikelyIndonesianPrompt(prompt) ? 'Indonesian' : 'the same language as the user';
  return [
    'You are Putra AI Studio / PUTRA AI PLUS.',
    `Answer in ${finalLanguage}.`,
    'Keep the response direct, useful, and do not repeat it in another language.',
    'Never mention the underlying model/provider name; if asked, say Putra AI Studio.'
  ].join(' ');
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

  private toOllamaMessages(prompt: string, history: ReturnType<PutraAiService['toConversationHistory']>, mode: 'text' | 'vision' = 'vision') {
    const isTextMode = mode === 'text';
    const messages = history.slice(isTextMode ? -4 : -10).map((message) => ({
      role: message.role === 'model' ? 'assistant' : 'user',
      content: normalizeWhitespace(message.text).slice(0, isTextMode ? 900 : 2500),
    }));

    return [
      {
        role: 'system',
        content: isTextMode ? getFastTextSystemPrompt(prompt) : getOllamaSystemPrompt(prompt),
      },
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

  private async readOllamaReply(response: Response, callbacks: SendMessageCallbacks = {}, prompt = '') {
    let fullText = '';
    let fullThinking = '';

    const consumeLine = (line: string) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;

      const data = this.parseOllamaLine(cleanLine);
      if (data) {
        const thinkingChunk = data?.message?.thinking || data?.thinking || '';
        const contentChunk = data?.message?.content || data?.response || '';

        fullThinking += thinkingChunk;
        fullText += contentChunk;
        if (fullThinking && !fullText) callbacks.onThinking?.(hasCjkText(fullThinking) ? getThinkingPlaceholder(prompt) : getThinkingPreview(fullThinking));
        if (contentChunk && fullText) callbacks.onContent?.(sanitizeModelIdentity(fullText));
      } else {
        fullText += cleanLine;
        callbacks.onContent?.(sanitizeModelIdentity(fullText));
      }
    };

    if (!response.body) {
      const rawBody = await response.text();
      for (const line of rawBody.split('\n')) consumeLine(line);
      return {
        text: sanitizeModelIdentity(fullText),
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
      text: sanitizeModelIdentity(fullText),
      thinking: normalizeWhitespace(fullThinking),
    };
  }

  private async askVision(
    prompt: string,
    imageAttachment: Attachment,
    history: ReturnType<PutraAiService['toConversationHistory']>,
    callbacks: SendMessageCallbacks = {},
  ) {
    const content = normalizeWhitespace(prompt) || 'Jelaskan gambar ini secara detail';
    const imageBase64 = validateOllamaImageAttachment(imageAttachment);

    callbacks.onThinking?.('Menganalisis gambar dengan Putra AI Studio...');

    const response = await fetch(PRIMARY_OLLAMA_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_VISION_MODEL,
        messages: [
          ...this.toOllamaMessages(content, history).slice(0, -1),
          {
            role: 'user',
            content,
            images: [imageBase64],
          },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Ollama vision gagal: ${response.status} ${errorText}`.trim());
    }

    const reply = await this.readOllamaReply(response, callbacks, content);
    if (!reply.text) {
      throw new Error('Ollama vision tidak mengirim balasan. Pastikan model vision sudah tersedia di server.');
    }

    const parsedReply = splitAiThinking(sanitizeModelIdentity(reply.text));
    return {
      text: sanitizeModelIdentity(parsedReply.text || reply.text),
      thinking: reply.thinking || parsedReply.thinking,
      mode: 'vision',
    };
  }
  private async sendToOllama(
    prompt: string,
    attachments: Attachment[],
    history: ReturnType<PutraAiService['toConversationHistory']>,
    callbacks: SendMessageCallbacks = {},
  ) {
    const imageAttachment = attachments.find((attachment) => attachment.mimeType.startsWith('image/') && attachment.data);
    if (imageAttachment) {
      return this.askVision(prompt, imageAttachment, history, callbacks);
    }

    const content = normalizeWhitespace(prompt);

    const response = await fetch(PRIMARY_OLLAMA_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_TEXT_MODEL,
        messages: this.toOllamaMessages(content, history, 'text'),

        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cloudflare/Ollama gagal: ${response.status}`);
    }

    const reply = await this.readOllamaReply(response, callbacks, content);
    if (!reply.text) {
      throw new Error('Cloudflare/Ollama tidak mengirim balasan.');
    }
    const parsedReply = splitAiThinking(sanitizeModelIdentity(reply.text));

    return {
      text: sanitizeModelIdentity(parsedReply.text || reply.text),
      thinking: reply.thinking || parsedReply.thinking,
      mode: 'text',
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

    const reply = sanitizeModelIdentity(data?.text || data?.content || extractFallbackText(data));
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
      const hasDocumentAttachment = attachments.some((attachment) => !attachment.mimeType.startsWith('image/'));
      const primaryResponse = hasDocumentAttachment
        ? await this.sendToFallbackApi(text.trim(), attachments, conversationHistory)
        : await this.sendToOllama(text.trim(), attachments, conversationHistory, callbacks);
      return {
        text: primaryResponse.text,
        thinking: primaryResponse.thinking,
        imageBase64: '',
        mode: primaryResponse.mode,
      };
    } catch (primaryError) {
      console.warn('Cloudflare/Ollama gagal, fallback ke PutraAi-V1:', primaryError);
      if (attachments.some((attachment) => attachment.mimeType.startsWith('image/')) || isVisionInputError(primaryError)) {
        throw new Error(getUserFacingError(primaryError));
      }

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










