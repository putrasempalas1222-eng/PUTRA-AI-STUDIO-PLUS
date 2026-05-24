import React, { useState, useRef, useEffect } from 'react';
import { Send, Plus, Image as ImageIcon, Mic, X, FileText, File, Music, Square } from 'lucide-react';
import { Attachment } from '../types';

interface ChatInputProps {
  onSendMessage: (message: string, attachments: Attachment[]) => void;
  isLoading: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
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
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const fileToBase64 = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64Data = await fileToBase64(file);
        newAttachments.push({
          id: Date.now().toString() + i,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: base64Data
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const base64Data = await fileToBase64(audioBlob);
        
        setAttachments(prev => [...prev, {
          id: Date.now().toString(),
          name: `Pesan_Suara_${new Date().toLocaleTimeString().replace(/:/g, '-')}.webm`,
          mimeType: 'audio/webm',
          data: base64Data
        }]);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error("Gagal mengakses mikrofon:", error);
      alert("Tidak dapat mengakses mikrofon. Periksa izin mikrofon Anda.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
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
    if ((input.trim() || attachments.length > 0) && !isLoading && !isRecording) {
      onSendMessage(input.trim(), attachments);
      setInput('');
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
    if (mimeType.startsWith('audio/')) return <Music size={16} className="text-purple-500" />;
    if (mimeType.includes('pdf')) return <FileText size={16} className="text-red-500" />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <FileText size={16} className="text-blue-600" />;
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return <File size={16} className="text-green-600" />;
    return <File size={16} className="text-slate-500" />;
  };

  return (
    <div className="relative flex flex-col bg-[#f0f4f9] rounded-[28px] md:rounded-[32px] shadow-lg shadow-slate-900/5 transition-all focus-within:bg-white focus-within:shadow-[0_8px_24px_rgba(15,23,42,0.08)] focus-within:ring-1 focus-within:ring-gray-200">
      
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
            <div key={att.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl pl-3 pr-1 py-1.5 shadow-sm max-w-[200px]">
              {getFileIcon(att.mimeType)}
              <span className="text-xs text-slate-700 truncate flex-1">{att.name}</span>
              <button 
                type="button" 
                onClick={() => removeAttachment(att.id)}
                disabled={isLoading}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
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
            <span className="text-sm font-medium text-red-600">Merekam suara... {formatTime(recordingTime)}</span>
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

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="flex items-end gap-1.5 md:gap-2 px-2 py-2">
        {/* Left Action Buttons */}
        <div className="flex items-center gap-0.5 md:gap-1 pb-1 pl-1 md:pl-2">
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isRecording}
            className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors disabled:opacity-50" 
            title="Unggah dokumen (PDF, Word, Excel)"
          >
            <Plus size={20} />
          </button>
          <button 
            type="button" 
            onClick={() => imageInputRef.current?.click()}
            disabled={isLoading || isRecording}
            className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors disabled:opacity-50" 
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
          placeholder={isRecording ? "Sedang merekam..." : "Tulis pesan di sini"}
          className="flex-1 min-w-0 max-h-[200px] bg-transparent border-none focus:ring-0 resize-none py-3 px-1.5 md:px-2 text-[15px] text-slate-800 placeholder-slate-500 outline-none disabled:opacity-50"
          rows={1}
          disabled={isLoading || isRecording}
        />

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1 pb-1 pr-1 md:pr-2">
          {input.trim() || attachments.length > 0 ? (
            <button
              type="submit"
              disabled={isLoading || isRecording}
              className="p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
              aria-label="Kirim pesan"
            >
              <Send size={18} />
            </button>
          ) : (
            <button 
              type="button" 
              onClick={startRecording}
              disabled={isLoading || isRecording}
              className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors disabled:opacity-50" 
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
