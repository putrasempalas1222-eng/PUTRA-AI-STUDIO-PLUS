import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Volume2, VolumeX, Wand2 } from 'lucide-react';
import { geminiService } from '../services/geminiService';

type VoiceRole = 'user' | 'model';
type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

interface VoiceMessage {
  id: string;
  role: VoiceRole;
  text: string;
}

interface SpeechSynthesisBoundaryEvent extends Event {
  charIndex: number;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface SoreaVoiceProps {
  isLoggedIn: boolean;
  onRequireLogin: () => void;
}

const APP_ICON_URL = 'https://firebasestorage.googleapis.com/v0/b/play-integrity-2adpr7x4a8xhyex.firebasestorage.app/o/Desain_tanpa_judul-removebg-preview.png?alt=media&token=d5be2a46-6352-48a2-89ae-e89574279f09';

export const SoreaVoice: React.FC<SoreaVoiceProps> = ({ isLoggedIn, onRequireLogin }) => {
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [interimText, setInterimText] = useState('');
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [speakingCharIndex, setSpeakingCharIndex] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement | null>(null);
  const latestDraftRef = useRef('');
  const latestInterimRef = useRef('');
  const speakingTextRef = useRef('');
  const speakingMessageIdRef = useRef<string | null>(null);

  const isListening = status === 'listening';
  const isThinking = status === 'thinking';
  const isSpeaking = status === 'speaking';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    if (!speakingMessageId || !activeWordRef.current) return;

    activeWordRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }, [speakingCharIndex, speakingMessageId]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = (text: string, messageId: string) => {
    if (!autoSpeak || !('speechSynthesis' in window)) {
      setSpeakingMessageId(null);
      setSpeakingCharIndex(0);
      setStatus('idle');
      return;
    }

    speakingTextRef.current = text;
    speakingMessageIdRef.current = messageId;
    setSpeakingMessageId(messageId);
    setSpeakingCharIndex(0);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onboundary = (event) => {
      const boundaryEvent = event as SpeechSynthesisBoundaryEvent;
      setSpeakingCharIndex(boundaryEvent.charIndex);
    };
    utterance.onend = () => {
      speakingTextRef.current = '';
      speakingMessageIdRef.current = null;
      setSpeakingMessageId(null);
      setSpeakingCharIndex(0);
      setStatus('idle');
    };
    utterance.onerror = () => {
      speakingTextRef.current = '';
      speakingMessageIdRef.current = null;
      setSpeakingMessageId(null);
      setSpeakingCharIndex(0);
      setStatus('idle');
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setStatus('speaking');
  };

  const sendToAi = async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText || isThinking) return;

    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    setError('');
    setDraft('');
    setInterimText('');
    setStatus('thinking');

    const userMessage: VoiceMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: cleanText,
    };

    setMessages((current) => [...current, userMessage]);

    try {
      const aiResponse = await geminiService.sendMessage(
        [
          'Mode: Sorea Voice.',
          'Jawab sebagai asisten suara yang natural, ringkas, dan langsung ke inti.',
          'Jangan membuka jawaban dengan sapaan seperti "Halo", "Hai", atau "Halo lagi" kecuali user memang menyapa terlebih dahulu.',
          'Jangan menyebut bahwa kamu sedang dalam mode voice.',
          'Jika user bertanya siapa pembuat, developer, pemilik, atau creator kamu, jawab bahwa pembuatmu adalah M Putra Ramadhani.',
          'Gunakan kalimat pendek yang enak didengar saat dibacakan.',
          '',
          `User: ${cleanText}`,
        ].join('\n'),
        [],
        messages
      );

      const modelMessage: VoiceMessage = {
        id: `${Date.now()}-ai`,
        role: 'model',
        text: aiResponse.text,
      };

      setMessages((current) => [...current, modelMessage]);
      speak(aiResponse.text, modelMessage.id);
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Sorea Voice gagal mendapatkan jawaban.');
    }
  };

  const startListening = () => {
    const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      setError('Browser ini belum mendukung voice recognition. Coba gunakan Chrome atau Edge.');
      return;
    }

    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    window.speechSynthesis?.cancel();
    setError('');
    setDraft('');
    setInterimText('');

    const recognition = new SpeechRecognitionApi();
    recognition.lang = 'id-ID';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const finalParts: string[] = [];
      const interimParts: string[] = [];

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript.trim();
        if (!transcript) continue;

        if (result.isFinal) {
          finalParts.push(transcript);
        } else {
          interimParts.push(transcript);
        }
      }

      const finalText = finalParts.join(' ').trim();
      const interimText = interimParts.join(' ').trim();

      latestDraftRef.current = finalText;
      latestInterimRef.current = interimText;
      setDraft(finalText);
      setInterimText(interimText);
    };

    recognition.onerror = (event) => {
      setStatus('idle');
      setError(`Mic berhenti: ${event.error}`);
    };

    recognition.onend = () => {
      const textToSend = [latestDraftRef.current, latestInterimRef.current].filter(Boolean).join(' ');
      if (textToSend.trim()) {
        void sendToAi(textToSend);
      } else {
        setStatus('idle');
      }
      setInterimText('');
    };

    recognitionRef.current = recognition;
    latestDraftRef.current = '';
    latestInterimRef.current = '';
    recognition.start();
    setStatus('listening');
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setStatus('idle');
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    speakingTextRef.current = '';
    speakingMessageIdRef.current = null;
    setSpeakingMessageId(null);
    setSpeakingCharIndex(0);
    setStatus('idle');
  };

  const handlePrimaryAction = () => {
    if (isListening) {
      stopListening();
      return;
    }

    if (isSpeaking) {
      stopSpeaking();
      return;
    }

    startListening();
  };

  const statusText = isListening
    ? 'Mendengarkan suara Anda'
    : isThinking
      ? 'Sorea sedang menyusun jawaban'
      : isSpeaking
        ? 'Sorea sedang berbicara'
        : 'Tekan mic untuk mulai bicara';

  const renderVoiceText = (message: VoiceMessage) => {
    if (message.role === 'user' || message.id !== speakingMessageId) {
      return message.text;
    }

    let charCursor = 0;
    const parts = message.text.split(/(\s+)/);

    return parts.map((part, index) => {
      const start = charCursor;
      const end = start + part.length;
      charCursor = end;
      const isWhitespace = /^\s+$/.test(part);
      const isActive = !isWhitespace && speakingCharIndex >= start && speakingCharIndex < end;

      return (
        <span
          key={`${message.id}-${index}`}
          ref={isActive ? activeWordRef : undefined}
          className={isActive ? 'rounded-md bg-gradient-to-r from-blue-500 to-violet-500 px-1 py-0.5 font-semibold text-white shadow-sm' : ''}
        >
          {part}
        </span>
      );
    });
  };

  return (
    <main className="relative flex min-h-0 flex-1 overflow-hidden bg-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 28%, rgba(59, 130, 246, 0.16), rgba(255, 255, 255, 0.84) 36%, #ffffff 72%)',
        }}
      />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-5xl flex-col px-4 py-5 md:px-6">
        <section className="flex flex-1 min-h-0 flex-col items-center">
          <div className="flex w-full max-w-3xl flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 shadow-sm ring-1 ring-blue-100">
              <img src={APP_ICON_URL} alt="Sorea Voice" className="h-10 w-10 object-contain" />
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-slate-200">
              <Wand2 size={14} />
              Sorea Voice
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-800 md:text-5xl">
              Ngobrol langsung dengan AI
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 md:text-base">
              Bicara natural, Sorea mengubah suara menjadi teks, memahami konteks, lalu menjawab kembali dengan suara.
            </p>
          </div>

          <div className="mt-8 flex w-full max-w-3xl flex-1 min-h-0 flex-col rounded-2xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-800">{statusText}</p>
                <p className="text-xs text-slate-500">
                  {draft || interimText || 'Transkrip suara akan muncul di sini.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoSpeak((value) => !value)}
                className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold transition-colors ${
                  autoSpeak ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {autoSpeak ? <Volume2 size={15} /> : <VolumeX size={15} />}
                Auto voice
              </button>
            </div>

            <div ref={conversationRef} className="flex-1 overflow-y-auto px-4 py-4">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
                  Mulai dengan menekan mic, misalnya: "Sorea, bantu saya cari ide konten hari ini."
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[82%] rounded-2xl px-4 py-3 text-left text-sm leading-6 ${
                          message.role === 'user'
                            ? 'rounded-tr-sm bg-blue-600 text-white'
                            : 'rounded-tl-sm bg-slate-100 text-slate-800'
                        }`}
                      >
                        {renderVoiceText(message)}
                      </div>
                    </div>
                  ))}
                  {isThinking && (
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-violet-500 [animation-delay:150ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-rose-500 [animation-delay:300ms]" />
                      Sorea berpikir...
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 px-4 py-4">
              {(draft || interimText) && (
                <div className="mb-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-slate-700">
                  <span className="font-semibold text-blue-700">Anda:</span> {draft}
                  {interimText && <span className="text-slate-400"> {interimText}</span>}
                </div>
              )}

              {error && (
                <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  disabled={isThinking}
                  className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                    isListening
                      ? 'bg-red-500 shadow-red-200'
                      : isSpeaking
                        ? 'bg-slate-800 shadow-slate-200'
                        : 'bg-blue-600 shadow-blue-200 hover:bg-blue-500'
                  }`}
                  aria-label={isListening || isSpeaking ? 'Berhenti' : 'Mulai bicara'}
                >
                  {isListening || isSpeaking ? <Square size={24} fill="currentColor" /> : <Mic size={28} />}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
