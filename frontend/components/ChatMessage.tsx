import React, { useEffect, useMemo, useState } from 'react';
import { Message } from '../types';
import { Check, Copy, Download, ExternalLink, FileText, Image as ImageIcon, Music, File, Play, Volume2, Square, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { downloadDocx } from '../services/docx';

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

const APP_ICON_URL = 'https://firebasestorage.googleapis.com/v0/b/play-integrity-2adpr7x4a8xhyex.firebasestorage.app/o/Desain_tanpa_judul-removebg-preview.png?alt=media&token=d5be2a46-6352-48a2-89ae-e89574279f09';
const FENCED_CODE_BLOCK_PATTERN = /(```[\s\S]*?```)/g;
const INLINE_CODE_PATTERN = /(`[^`\n]+`)/g;
const BARE_URL_PATTERN = /https?:\/\/[^\s<>\])]+/g;

function getLinkLabel(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const firstPath = parsed.pathname.split('/').filter(Boolean)[0];

    if (host.includes('arxiv.org')) return 'arXiv';
    if (host.includes('doi.org')) return 'DOI';
    if (host.includes('scholar.google')) return 'Google Scholar';
    if (host.includes('researchgate.net')) return 'ResearchGate';
    if (host.includes('semanticscholar.org')) return 'Semantic Scholar';
    if (host.includes('github.com')) return 'GitHub';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube';

    return firstPath ? host : host;
  } catch {
    return 'Link';
  }
}

function getLinkPreviewTitle(url: string, fallback: string) {
  if (fallback && fallback !== url) return fallback;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const pathParts = parsed.pathname
      .split('/')
      .filter(Boolean)
      .slice(0, 3)
      .join(' / ');

    return pathParts ? `${host} / ${pathParts}` : host;
  } catch {
    return fallback || url;
  }
}

function linkifyBareUrls(markdown: string) {
  return markdown
    .split(FENCED_CODE_BLOCK_PATTERN)
    .map((blockPart) => {
      if (blockPart.startsWith('```')) return blockPart;

      return blockPart
        .split(INLINE_CODE_PATTERN)
        .map((inlinePart) => {
          if (inlinePart.startsWith('`')) return inlinePart;

          return inlinePart.replace(BARE_URL_PATTERN, (url, offset, source) => {
            const before = source.slice(Math.max(0, offset - 2), offset);
            const previousChar = source[offset - 1] || '';

            if (before === '](' || previousChar === '<') {
              return url;
            }

            const trailing = url.match(/[.,;:!?]+$/)?.[0] || '';
            const cleanUrl = trailing ? url.slice(0, -trailing.length) : url;
            return `<${cleanUrl}>${trailing}`;
          });
        })
        .join('');
    })
    .join('');
}

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

interface ReadAloudButtonProps {
  text: string;
}

const ReadAloudButton: React.FC<ReadAloudButtonProps> = ({ text }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const handleReadAloud = () => {
    if (!text.trim()) return;

    if (!('speechSynthesis' in window)) {
      alert('Browser ini belum mendukung pembaca teks.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  return (
    <button
      type="button"
      onClick={handleReadAloud}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
      title={isSpeaking ? 'Berhenti membaca' : 'Bacakan'}
      aria-label={isSpeaking ? 'Berhenti membaca' : 'Bacakan'}
    >
      {isSpeaking ? <Square size={14} fill="currentColor" /> : <Volume2 size={14} />}
      <span>{isSpeaking ? 'Berhenti' : 'Bacakan'}</span>
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

interface DownloadDocxButtonProps {
  text: string;
  title?: string;
}

const DownloadDocxButton: React.FC<DownloadDocxButtonProps> = ({ text, title = 'Dokumen PUTRA AI' }) => {
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = () => {
    downloadDocx(text, title);
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
      title={downloaded ? 'DOCX terunduh' : 'Unduh DOCX'}
      aria-label={downloaded ? 'DOCX terunduh' : 'Unduh DOCX'}
    >
      {downloaded ? <Check size={14} /> : <FileText size={14} />}
      <span>{downloaded ? 'Terunduh' : 'Unduh DOCX'}</span>
    </button>
  );
};

interface CodeBlockProps {
  code: string;
  language?: string;
  onRunCode?: (code: string, language?: string) => void;
}

const canRunAsHtml = (code: string, language?: string) => {
  const normalizedLanguage = String(language || '').toLowerCase();
  const normalizedCode = code.toLowerCase();

  return normalizedLanguage === 'html' ||
    normalizedLanguage === 'htm' ||
    normalizedCode.includes('<!doctype html') ||
    normalizedCode.includes('<html') ||
    normalizedCode.includes('<body') ||
    normalizedCode.includes('<head');
};

const canRunCode = (code: string, language?: string) => {
  const normalizedLanguage = String(language || '').toLowerCase();

  return canRunAsHtml(code, language) ||
    ['javascript', 'js', 'css', 'python', 'py'].includes(normalizedLanguage);
};

function buildRunnerDocument(code: string, language?: string) {
  const normalizedLanguage = String(language || '').toLowerCase();

  if (canRunAsHtml(code, language)) {
    return code;
  }

  if (normalizedLanguage === 'css') {
    return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${code}</style>
</head>
<body>
  <main>
    <h1>CSS Preview</h1>
    <p>Preview area untuk melihat style CSS yang dijalankan.</p>
    <button>Contoh Tombol</button>
    <div class="card">Contoh elemen .card</div>
  </main>
</body>
</html>`;
  }

  if (normalizedLanguage === 'python' || normalizedLanguage === 'py') {
    return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 16px; background: #0f172a; color: #e2e8f0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .status { color: #93c5fd; margin-bottom: 12px; }
    pre { white-space: pre-wrap; line-height: 1.5; }
  </style>
  <script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"></script>
</head>
<body>
  <div class="status" id="status">Loading Python runtime...</div>
  <pre id="output"></pre>
  <script>
    const code = ${JSON.stringify(code)};
    const output = document.getElementById('output');
    const status = document.getElementById('status');
    const write = (text = '') => { output.textContent += String(text) + '\\n'; };

    (async () => {
      try {
        const pyodide = await loadPyodide();
        pyodide.setStdout({ batched: write });
        pyodide.setStderr({ batched: write });
        status.textContent = 'Running Python...';
        await pyodide.runPythonAsync(code);
        status.textContent = 'Done';
      } catch (error) {
        status.textContent = 'Error';
        write(error && error.message ? error.message : error);
      }
    })();
  </script>
</body>
</html>`;
  }

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 16px; background: #0f172a; color: #e2e8f0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    pre { white-space: pre-wrap; line-height: 1.5; }
  </style>
</head>
<body>
  <pre id="output"></pre>
  <script>
    const output = document.getElementById('output');
    const log = (...args) => {
      output.textContent += args.map((item) => {
        if (typeof item === 'string') return item;
        try { return JSON.stringify(item, null, 2); } catch { return String(item); }
      }).join(' ') + '\\n';
    };
    console.log = log;
    console.error = log;
    console.warn = log;
    try {
      ${code}
    } catch (error) {
      log(error && error.message ? error.message : error);
    }
  </script>
</body>
</html>`;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, onRunCode }) => (
  <div className="my-4 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {language || 'kode'}
      </span>
      <div className="flex items-center gap-1.5">
        {onRunCode && canRunCode(code, language) && (
          <button
            type="button"
            onClick={() => onRunCode(code, language)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
            title="Jalankan kode"
            aria-label="Jalankan kode"
          >
            <Play size={14} fill="currentColor" />
            <span>Run</span>
          </button>
        )}
        <CopyButton
          text={code}
          label="Salin kode"
          className="text-slate-600 hover:bg-slate-100"
        />
      </div>
    </div>
    <pre className="m-0 max-h-none overflow-x-auto whitespace-pre bg-transparent p-4 text-sm leading-relaxed">
      <code>{code}</code>
    </pre>
  </div>
);

interface PreviewLinkProps {
  href?: string;
  children: React.ReactNode;
}

const PreviewLink: React.FC<PreviewLinkProps> = ({ href = '', children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const childText = React.Children.toArray(children).join('').trim();
  const label = href ? getLinkLabel(href) : childText.replace(/^\[|\]$/g, '') || 'Link';
  const previewTitle = href ? getLinkPreviewTitle(href, childText) : childText;

  const handlePointerUp = (event: React.PointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType === 'mouse') return;
    if (!isOpen) {
      event.preventDefault();
      setIsOpen(true);
    }
  };

  return (
    <span
      className="relative inline-flex align-baseline"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onPointerUp={handlePointerUp}
        className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 no-underline shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        <span className="truncate">{label}</span>
        <ExternalLink size={12} aria-hidden="true" className="shrink-0" />
      </a>
      {isOpen && href && (
        <span className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-[min(78vw,360px)] rounded-xl bg-slate-900 px-4 py-3 text-left text-white shadow-xl ring-1 ring-black/10">
          <span className="block text-xs font-semibold text-blue-200">{label}</span>
          <span className="mt-1 block text-sm font-semibold leading-snug">{previewTitle}</span>
          <span className="mt-2 block truncate text-xs text-slate-300">{href}</span>
        </span>
      )}
    </span>
  );
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isModel = message.role === 'model';
  const [typedWordCount, setTypedWordCount] = useState(0);
  const [codePreview, setCodePreview] = useState<{ code: string; language?: string } | null>(null);
  const shouldAnimate = isModel && message.animateTyping && message.text;
  const words = useMemo(() => message.text.split(/(\s+)/), [message.text]);
  const renderedText = shouldAnimate ? words.slice(0, typedWordCount).join('') : message.text;
  const renderedMarkdown = useMemo(() => linkifyBareUrls(renderedText), [renderedText]);
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
            <>
              <div className="bg-[#f0f4f9] text-slate-800 px-5 py-3.5 rounded-3xl rounded-tr-sm">
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.text}</p>
              </div>
              <CopyButton
                text={message.text}
                label="Salin"
                className="text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              />
            </>
          )}
        </div>
      </div>
    );
  }

  // Model Message - Left aligned, no bubble, with assistant icon
  return (
    <div className="flex w-full mb-8 justify-start">
      <div className="flex max-w-full md:max-w-[90%] flex-row items-start gap-4">
        {/* Assistant icon */}
        <div className="flex-shrink-0 mt-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 shadow-sm ring-1 ring-blue-100">
            <img
              src={APP_ICON_URL}
              alt="PUTRA AI STUDIO"
              className="h-6 w-6 object-contain"
            />
          </div>
        </div>

        {/* Message Content */}
        <div className="min-w-0 flex-1 overflow-hidden">
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

                  return <CodeBlock code={code} language={language} onRunCode={(codeToRun, codeLanguage) => setCodePreview({ code: codeToRun, language: codeLanguage })} />;
                },
                a: ({ href, children }) => <PreviewLink href={href}>{children}</PreviewLink>,
              }}
            >
              {renderedMarkdown}
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
              <ReadAloudButton text={message.text} />
              {message.downloadDocx && (
                <DownloadDocxButton text={message.text} title={message.docxTitle} />
              )}
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
      {codePreview && (
        <div className="fixed inset-0 z-50 flex bg-slate-950/70 p-3 backdrop-blur-sm md:p-6">
          <div className="relative flex min-h-0 w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">Run Code</p>
                <p className="text-xs text-slate-500">Hasil jalankan kode</p>
              </div>
              <button
                type="button"
                onClick={() => setCodePreview(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                title="Tutup preview"
                aria-label="Tutup preview"
              >
                <X size={20} />
              </button>
            </div>
            <iframe
              title="Run Code"
              srcDoc={buildRunnerDocument(codePreview.code, codePreview.language)}
              sandbox="allow-scripts allow-forms allow-modals"
              className="min-h-0 flex-1 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
};
