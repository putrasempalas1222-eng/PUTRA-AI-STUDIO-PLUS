import React, { useState, useRef, useEffect } from 'react';
import { Send, Plus, Image as ImageIcon, Mic, X, FileText, File, Square } from 'lucide-react';
import { Attachment } from '../types';

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

interface ChatInputProps {
  onSendMessage: (message: string, attachments: Attachment[]) => void;
  isLoading: boolean;
  variant?: 'default' | 'hero';
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  variant = 'default',
  placeholder = 'Tulis pesan di sini',
}) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const isHero = variant === 'hero';
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<number | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recognitionRef.current?.abort();
    };
  }, []);

  const readFileAsDataUrl = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = error => reject(error);
    });
  };

  const dataUrlToBase64 = (dataUrl: string) => dataUrl.split(',')[1] || '';

  const compressImageToBase64 = async (file: File, maxWidth = 800, quality = 0.7): Promise<string> => {
    const dataUrl = await readFileAsDataUrl(file);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrlToBase64(dataUrl));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(dataUrlToBase64(canvas.toDataURL('image/jpeg', quality)));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  };

  const fileToBase64 = async (file: File): Promise<{ data: string; mimeType: string }> => {
    if (file.type.startsWith('image/')) {
      return {
        data: await compressImageToBase64(file),
        mimeType: 'image/jpeg',
      };
    }

    return {
      data: dataUrlToBase64(await readFileAsDataUrl(file)),
      mimeType: file.type || 'application/octet-stream',
    };
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const fileData = await fileToBase64(file);
        newAttachments.push({
          id: Date.now().toString() + i,
          name: file.name,
          mimeType: fileData.mimeType,
          data: fileData.data
        });
      } catch (error) {
        console.error("Gagal membaca file:", error);
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    if (e.target) e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const startRecording = async () => {
    const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      alert('Browser ini belum mendukung ubah suara ke teks. Coba gunakan Chrome atau Edge.');
      return;
    }

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

      setVoiceTranscript(finalParts.join(' ').trim());
      setInterimTranscript(interimParts.join(' ').trim());
    };

    recognition.onerror = (event) => {
      console.error('Gagal mengubah suara ke teks:', event.error);
      setIsRecording(false);
      if (timerRef.current) window.clearInterval(timerRef.current);
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimTranscript('');
      if (timerRef.current) window.clearInterval(timerRef.current);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setRecordingTime(0);

    timerRef.current = window.setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalText = [input.trim(), voiceTranscript.trim()].filter(Boolean).join('\n\n');

    if ((finalText || attachments.length > 0) && !isLoading && !isRecording) {
      onSendMessage(finalText, attachments);
      setInput('');
      setVoiceTranscript('');
      setInterimTranscript('');
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon size={16} className="text-blue-500" />;
    if (mimeType.includes('pdf')) return <FileText size={16} className="text-red-500" />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <FileText size={16} className="text-blue-600" />;
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return <File size={16} className="text-green-600" />;
    return <File size={16} className="text-slate-500" />;
  };

  return (
    <div className={`relative flex flex-col rounded-[28px] shadow-lg transition-all md:rounded-[32px] ${
      isHero
        ? 'bg-white shadow-slate-900/10 ring-1 ring-slate-200/80 focus-within:bg-white focus-within:ring-blue-200'
        : 'bg-[#f0f4f9] shadow-slate-900/5 focus-within:bg-white focus-within:shadow-[0_8px_24px_rgba(15,23,42,0.08)] focus-within:ring-1 focus-within:ring-gray-200'
    }`}>
      
      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
        accept=".pdf,.docx,.xlsx,.xls,.csv,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        multiple
      />
      <input 
        type="file" 
        ref={imageInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
        accept="image/*"
        multiple
      />

      {/* Attachments Preview Area */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 pb-0">
          {attachments.map(att => (
            <div key={att.id} className={`flex max-w-[200px] items-center gap-2 rounded-xl py-1.5 pl-3 pr-1 shadow-sm ${
              isHero ? 'border border-slate-200 bg-slate-50' : 'border border-slate-200 bg-white'
            }`}>
              {getFileIcon(att.mimeType)}
              <span className={`flex-1 truncate text-xs ${isHero ? 'text-slate-700' : 'text-slate-700'}`}>{att.name}</span>
              <button 
                type="button" 
                onClick={() => removeAttachment(att.id)}
                disabled={isLoading}
                className={`rounded-full p-1 transition-colors ${isHero ? 'text-slate-400 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-100'}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recording Indicator */}
      {isRecording && (
        <div className="flex items-center justify-between px-4 py-3 bg-red-50 rounded-t-[32px] border-b border-red-100">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-red-600">Mendengar suara... {formatTime(recordingTime)}</span>
          </div>
          <button 
            type="button" 
            onClick={stopRecording}
            className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-colors"
          >
            <Square size={16} fill="currentColor" />
          </button>
        </div>
      )}

      {(voiceTranscript || interimTranscript) && (
        <div className="px-4 pt-3">
          <div className={`rounded-2xl px-3 py-2 text-sm ${
            isHero ? 'bg-blue-50 text-slate-700' : 'bg-white text-slate-700'
          }`}>
            <span className="font-medium text-blue-600">Suara:</span>{' '}
            <span>{voiceTranscript}</span>
            {interimTranscript && <span className="text-slate-400"> {interimTranscript}</span>}
          </div>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="flex items-end gap-1.5 md:gap-2 px-2 py-2">
        {/* Left Action Buttons */}
        <div className="flex items-center gap-0.5 md:gap-1 pb-1 pl-1 md:pl-2">
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isRecording}
            className={`rounded-full p-2 transition-colors disabled:opacity-50 ${
              isHero ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-500 hover:bg-slate-200'
            }`}
            title="Unggah dokumen (PDF, Word, Excel)"
          >
            <Plus size={20} />
          </button>
          <button 
            type="button" 
            onClick={() => imageInputRef.current?.click()}
            disabled={isLoading || isRecording}
            className={`rounded-full p-2 transition-colors disabled:opacity-50 ${
              isHero ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-500 hover:bg-slate-200'
            }`}
            title="Unggah gambar"
          >
            <ImageIcon size={20} />
          </button>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Sedang merekam..." : placeholder}
          className={`max-h-[200px] min-w-0 flex-1 resize-none border-none bg-transparent px-1.5 py-3 text-[15px] outline-none focus:ring-0 disabled:opacity-50 md:px-2 ${
            isHero ? 'text-slate-800 placeholder-slate-500' : 'text-slate-800 placeholder-slate-500'
          }`}
          rows={1}
          disabled={isLoading || isRecording}
        />

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1 pb-1 pr-1 md:pr-2">
          {input.trim() || voiceTranscript.trim() || attachments.length > 0 ? (
            <button
              type="submit"
              disabled={isLoading || isRecording}
              className={`rounded-full p-2 text-white transition-colors disabled:opacity-50 ${
                isHero ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-800 hover:bg-slate-700'
              }`}
              aria-label="Kirim pesan"
            >
              <Send size={18} />
            </button>
          ) : (
            <button 
              type="button" 
              onClick={startRecording}
              disabled={isLoading || isRecording}
              className={`rounded-full p-2 transition-colors disabled:opacity-50 ${
                isHero ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-500 hover:bg-slate-200'
              }`}
              title="Gunakan mikrofon"
            >
              <Mic size={20} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
