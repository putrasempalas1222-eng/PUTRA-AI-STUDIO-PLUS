import React, { useEffect, useMemo, useState } from 'react';
import { Message } from '../types';
import { Check, Copy, Download, Sparkles, FileText, Image as ImageIcon, Music, File } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
}

const copyText = async (text: string) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
};

const downloadImage = async (src: string, filename: string) => {
  if (!src) return;

  let downloadUrl = src;
  let shouldRevoke = false;

  if (!src.startsWith('data:')) {
    const response = await fetch(src);
    const blob = await response.blob();
    downloadUrl = URL.createObjectURL(blob);
    shouldRevoke = true;
  }

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  if (shouldRevoke) {
    URL.revokeObjectURL(downloadUrl);
  }
};

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ text, label = 'Salin', className = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;

    await copyText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${className}`}
      title={copied ? 'Tersalin' : label}
      aria-label={copied ? 'Tersalin' : label}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span>{copied ? 'Tersalin' : label}</span>
    </button>
  );
};

interface DownloadImageButtonProps {
  src: string;
  filename: string;
}

const DownloadImageButton: React.FC<DownloadImageButtonProps> = ({ src, filename }) => {
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = async () => {
    await downloadImage(src, filename);
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
      title={downloaded ? 'Terunduh' : 'Unduh'}
      aria-label={downloaded ? 'Terunduh' : 'Unduh'}
    >
      {downloaded ? <Check size={14} /> : <Download size={14} />}
      <span>{downloaded ? 'Terunduh' : 'Unduh'}</span>
    </button>
  );
};

interface CodeBlockProps {
  code: string;
  language?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => (
  <div className="my-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {language || 'kode'}
      </span>
      <CopyButton
        text={code}
        label="Salin kode"
        className="text-slate-600 hover:bg-slate-100"
      />
    </div>
    <pre className="m-0 overflow-x-auto bg-transparent p-4 text-sm leading-relaxed">
      <code>{code}</code>
    </pre>
  </div>
);

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isModel = message.role === 'model';
  const [typedWordCount, setTypedWordCount] = useState(0);
  const shouldAnimate = isModel && message.animateTyping && message.text;
  const words = useMemo(() => message.text.split(/(\s+)/), [message.text]);
  const renderedText = shouldAnimate ? words.slice(0, typedWordCount).join('') : message.text;
  const isAnimationComplete = !shouldAnimate || typedWordCount >= words.length;

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
        {/* Assistant icon */}
        <div className="flex-shrink-0 mt-1">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-red-500 flex items-center justify-center text-white shadow-sm">
            <Sparkles size={16} className="fill-white" />
          </div>
        </div>

        {/* Message Content */}
        <div className="flex-1 overflow-hidden">
          <div className="markdown-body text-[15px] text-slate-800">
            <ReactMarkdown
              components={{
                pre: ({ children }) => <>{children}</>,
                code: ({ inline, className, children, ...props }: any) => {
                  const code = String(children).replace(/\n$/, '');
                  const language = /language-(\w+)/.exec(className || '')?.[1];
                  const isInlineCode = inline ?? (!className && !code.includes('\n'));

                  if (isInlineCode) {
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  }

                  return <CodeBlock code={code} language={language} />;
                },
              }}
            >
              {renderedText}
            </ReactMarkdown>
          </div>
          {message.imageBase64 && isAnimationComplete && (
            <div className="mt-4">
              <img
                src={message.imageBase64}
                alt="Hasil gambar"
                className="max-w-full rounded-xl border border-slate-200 shadow-sm"
              />
            </div>
          )}
          {isAnimationComplete && (
            <div className="mt-3 flex flex-wrap justify-start gap-2">
              <CopyButton
                text={message.text}
                label="Salin"
                className="text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              />
              {message.imageBase64 && (
                <DownloadImageButton
                  src={message.imageBase64}
                  filename={`putra-ai-plus-${message.id}.png`}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
