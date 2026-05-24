import React, { useEffect, useMemo, useState } from 'react';
import { Message } from '../types';
import { Sparkles, FileText, Image as ImageIcon, Music, File } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isModel = message.role === 'model';
  const [typedWordCount, setTypedWordCount] = useState(0);
  const shouldAnimate = isModel && message.animateTyping && message.text;
  const words = useMemo(() => message.text.split(/(\s+)/), [message.text]);
  const renderedText = shouldAnimate ? words.slice(0, typedWordCount).join('') : message.text;

  useEffect(() => {
    if (!shouldAnimate) return;

    setTypedWordCount(0);
    const timer = window.setInterval(() => {
      setTypedWordCount((count) => {
        if (count >= words.length) {
          window.clearInterval(timer);
          return count;
        }

        return count + 1;
      });
    }, 28);

    return () => window.clearInterval(timer);
  }, [message.id, shouldAnimate, words.length]);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon size={16} className="text-blue-500" />;
    if (mimeType.startsWith('audio/')) return <Music size={16} className="text-purple-500" />;
    if (mimeType.includes('pdf')) return <FileText size={16} className="text-red-500" />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <FileText size={16} className="text-blue-600" />;
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return <File size={16} className="text-green-600" />;
    return <File size={16} className="text-slate-500" />;
  };

  if (!isModel) {
    // User Message - Right aligned bubble
    return (
      <div className="flex w-full mb-8 justify-end">
        <div className="max-w-[80%] flex flex-col items-end gap-2">
          
          {/* Render Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2 mb-1">
              {message.attachments.map(att => (
                <div key={att.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm max-w-[250px]">
                  {getFileIcon(att.mimeType)}
                  <span className="text-xs text-slate-700 truncate">{att.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Render Text */}
          {message.text && (
            <div className="bg-[#f0f4f9] text-slate-800 px-5 py-3.5 rounded-3xl rounded-tr-sm">
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.text}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Model Message - Left aligned, no bubble, with Sparkles icon
  return (
    <div className="flex w-full mb-8 justify-start">
      <div className="flex max-w-full md:max-w-[90%] flex-row items-start gap-4">
        {/* Putra Ai Icon */}
        <div className="flex-shrink-0 mt-1">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-red-500 flex items-center justify-center text-white shadow-sm">
            <Sparkles size={16} className="fill-white" />
          </div>
        </div>

        {/* Message Content */}
        <div className="flex-1 overflow-hidden">
          <div className="markdown-body text-[15px] text-slate-800">
            <ReactMarkdown>{renderedText}</ReactMarkdown>
          </div>
          {message.imageBase64 && (!shouldAnimate || typedWordCount >= words.length) && (
            <div className="mt-4">
              <img
                src={message.imageBase64}
                alt="Generated result"
                className="max-w-full rounded-xl border border-slate-200 shadow-sm"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
