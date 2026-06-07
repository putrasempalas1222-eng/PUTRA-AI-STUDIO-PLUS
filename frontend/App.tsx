import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, ChatSession, Attachment } from './types';
import { geminiService } from './services/AiServices';
import { auth, ensureUserDocument, getUserChatHistory, saveChatSession } from './services/firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Sidebar, AppView } from './components/Sidebar';
import { SoreaVoice } from './components/SoreaVoice';
import { PutraPpt } from './components/PutraPpt';
import { PutraPackages } from './components/PutraPackages';
import { PutraConvert } from './components/PutraConvert';
import { AuthModal, AuthMode } from './components/AuthModal';
import { AlertTriangle, Menu, Moon, Sparkles, Sun, LogOut, User as UserIcon } from 'lucide-react';

const THINKING_STEPS = [
  'Memahami permintaan',
  'Menentukan tujuan',
  'Menyusun jawaban',
];

const FALLBACK_THINKING_LINES = [
  'Connecting to PUTRA AI STUDIO...',
  'Understanding the request...',
  'Checking conversation context...',
  'Preparing the best answer...',
];

const INDONESIAN_THINKING_LINES = [
  'Menghubungkan ke PUTRA AI STUDIO...',
  'Membaca maksud pertanyaan...',
  'Menimbang konteks percakapan...',
  'Menyusun jawaban terbaik...',
];

const IMAGE_GENERATION_STEPS = [
  'Membaca prompt gambar',
  'Menyusun komposisi visual',
  'Merender gambar',
];

const IMAGE_ANALYSIS_STEPS = [
  'Memeriksa gambar',
  'Mengenali detail visual',
  'Menyusun analisis gambar',
];

const FILE_ANALYSIS_STEPS = [
  'Membaca file',
  'Mengambil poin penting',
  'Menyusun analisis file',
];
function isLikelyIndonesian(text: string) {
  const normalized = ` ${text.toLowerCase()} `;
  return /\b(apa|apakah|siapa|bagaimana|kenapa|mengapa|jelaskan|tolong|buatkan|perbaiki|gambar|file|saya|kamu|yang|dan|atau|dengan|untuk|dari|ini|itu)\b/.test(normalized);
}

function getFallbackThinkingLines(prompt: string) {
  return isLikelyIndonesian(prompt) ? INDONESIAN_THINKING_LINES : FALLBACK_THINKING_LINES;
}

const APP_ICON_URL = 'https://firebasestorage.googleapis.com/v0/b/play-integrity-2adpr7x4a8xhyex.firebasestorage.app/o/Desain_tanpa_judul-removebg-preview.png?alt=media&token=d5be2a46-6352-48a2-89ae-e89574279f09';

const IMAGE_GENERATION_KEYWORDS = [
  'buat gambar',
  'buatkan gambar',
  'generate gambar',
  'hasilkan gambar',
  'bikin gambar',
  'buat ilustrasi',
  'buatkan ilustrasi',
  'generate ilustrasi',
  'buat poster',
  'buatkan poster',
  'generate poster',
  'buat logo',
  'buatkan logo',
  'generate logo',
  'buat desain',
  'buatkan desain',
  'render gambar',
  'draw image',
  'generate image',
  'create image',
];

const IMAGE_GENERATION_PATTERN = /\b(buat|buatkan|bikin|generate|hasilkan|render|draw|create)\b[\s\S]{0,80}\b(gambar|image|ilustrasi|poster|logo|desain|visual)\b/i;

const DOCX_REQUEST_PATTERN = /\b(docx|word|ms word|microsoft word|file makalah|dokumen makalah|buatkan makalah|makalah|download file|file doc)\b/i;

const wantsDocxFile = (text: string) => DOCX_REQUEST_PATTERN.test(text);

const getDocxTitle = (text: string) => {
  const cleanText = text
    .replace(/\b(buatkan|buat|jadikan|generate|file|docx|word|makalah|dokumen|download|tentang|judul)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleanText ? `Makalah ${cleanText}` : 'Dokumen PUTRA AI';
};

const getThinkingSteps = (text: string, attachments: Attachment[]) => {
  if (attachments.some((attachment) => attachment.mimeType.startsWith('image/'))) {
    return IMAGE_ANALYSIS_STEPS;
  }

  if (attachments.length > 0) {
    return FILE_ANALYSIS_STEPS;
  }

  const normalizedText = text.toLowerCase();
  if (
    IMAGE_GENERATION_PATTERN.test(text) ||
    IMAGE_GENERATION_KEYWORDS.some((keyword) => normalizedText.includes(keyword))
  ) {
    return IMAGE_GENERATION_STEPS;
  }

  return THINKING_STEPS;
};

const isImageGenerationStepSet = (steps: string[]) => steps === IMAGE_GENERATION_STEPS;

type DisplayError = {
  title: string;
  code: string;
  detail: string;
};

function formatDisplayError(error: string): DisplayError {
  const rawError = String(error || '').trim();
  const codeMatch = rawError.match(/^([A-Z0-9_ -]{3,40})\s*:\s*([\s\S]*)$/);
  const code = codeMatch ? codeMatch[1].trim().replace(/\s+/g, '_') : 'APP_ERROR';
  const body = codeMatch ? codeMatch[2].trim() : rawError;
  const detailMatch = body.match(/^([\s\S]*?)\s*Detail\s*:\s*([\s\S]*)$/i);
  const message = (detailMatch ? detailMatch[1] : body).trim();
  const detail = (detailMatch ? detailMatch[2] : body).trim();
  const normalized = `${code} ${rawError}`.toLowerCase();

  if (
    normalized.includes('fetch') ||
    normalized.includes('server sedang ada perbaikan') ||
    normalized.includes('network') ||
    normalized.includes('econnrefused') ||
    normalized.includes('model_not_ready')
  ) {
    return {
      title: 'Server sedang ada perbaikan',
      code: code === 'APP_ERROR' ? 'SERVER_MAINTENANCE' : code,
      detail: detail || message || 'Koneksi ke server AI belum stabil.',
    };
  }

  return {
    title: message || 'Terjadi kesalahan',
    code,
    detail: detail || rawError || 'Silakan coba lagi.',
  };
}

const ErrorNotice: React.FC<{ error: string; compact?: boolean; isDark?: boolean }> = ({ error, compact = false, isDark = false }) => {
  const displayError = formatDisplayError(error);

  return (
    <div className={`mx-auto ${compact ? 'mt-4 max-w-xl' : 'mb-8 max-w-3xl'} rounded-2xl border p-4 text-left shadow-sm ${
      isDark
        ? 'border-amber-400/20 bg-amber-400/10 text-amber-50'
        : 'border-amber-200 bg-amber-50 text-amber-950'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-full p-2 ${isDark ? 'bg-amber-300/15 text-amber-200' : 'bg-amber-100 text-amber-700'}`}>
          <AlertTriangle size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{displayError.title}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${
              isDark ? 'bg-slate-950/40 text-amber-100' : 'bg-white text-amber-800 ring-1 ring-amber-200'
            }`}>
              {displayError.code}
            </span>
          </div>
          <p className={`mt-1 break-words text-xs leading-relaxed ${isDark ? 'text-amber-100/80' : 'text-amber-900/75'}`}>
            {displayError.detail}
          </p>
        </div>
      </div>
    </div>
  );
};

const ThinkingLoader: React.FC<{ step: string; steps: string[]; liveThinking?: string; fallbackLines?: string[] }> = ({ step, steps, liveThinking, fallbackLines = FALLBACK_THINKING_LINES }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [typedText, setTypedText] = useState('');
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const title = steps === IMAGE_ANALYSIS_STEPS
    ? 'Menganalisis gambar'
    : steps === FILE_ANALYSIS_STEPS
      ? 'Menganalisis file'
      : 'Thinking...';

  const hasLiveThinking = Boolean(liveThinking?.trim());
  const detailText = hasLiveThinking ? liveThinking!.trim() : fallbackLines[fallbackIndex];

  useEffect(() => {
    if (hasLiveThinking) return;

    const timer = window.setInterval(() => {
      setFallbackIndex((index) => (index + 1) % fallbackLines.length);
    }, 450);

    return () => window.clearInterval(timer);
  }, [fallbackLines.length, hasLiveThinking]);

  useEffect(() => {
    if (!isOpen) return;

    if (hasLiveThinking) {
      setTypedText(detailText);
      return;
    }

    if (!detailText.startsWith(typedText)) {
      setTypedText('');
      return;
    }

    let index = typedText.length;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedText(detailText.slice(0, index));

      if (index >= detailText.length) {
        window.clearInterval(timer);
      }
    }, 8);

    return () => window.clearInterval(timer);
  }, [detailText, hasLiveThinking, isOpen, typedText]);

  return (
    <div className="flex w-full mb-8 justify-start">
      <div className="flex max-w-[90%] flex-row items-start gap-4">
        <div className="flex-shrink-0 mt-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 shadow-sm ring-1 ring-blue-100">
            <img
              src={APP_ICON_URL}
              alt="PUTRA AI STUDIO"
              className="h-6 w-6 object-contain"
            />
          </div>
        </div>
        <div className="min-w-0 pt-1">
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            className="inline-flex text-left text-sm font-medium text-slate-500 transition-colors hover:text-blue-600 focus:outline-none focus-visible:underline dark:text-slate-400 dark:hover:text-blue-300"
            title={isOpen ? 'Sembunyikan isi pikiran AI' : 'Tampilkan isi pikiran AI'}
            aria-expanded={isOpen}
          >
            {title}
          </button>
          {isOpen && (
            <p className="mt-1 min-h-5 max-w-3xl text-[13px] font-normal leading-6 text-slate-500/85 dark:text-slate-400/85">
              {typedText}
              <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-slate-400 dark:bg-slate-500" />
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const ImageGenerationLoader: React.FC<{ step: string }> = ({ step }) => (
  <div className="flex w-full mb-8 justify-start">
    <div className="flex max-w-[92%] flex-row items-start gap-4">
      <div className="flex-shrink-0 mt-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 shadow-sm ring-1 ring-blue-100">
          <img
            src={APP_ICON_URL}
            alt="PUTRA AI STUDIO"
            className="h-6 w-6 object-contain"
          />
        </div>
      </div>

      <div className="min-w-0 pt-1">
        <div className="flex items-center gap-2 text-slate-700">
          <Sparkles size={16} className="text-blue-600" />
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          <p className="text-sm font-semibold text-slate-800">Membuat gambar</p>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{step}</p>
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTypingResponse, setIsTypingResponse] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [activeThinkingSteps, setActiveThinkingSteps] = useState(THINKING_STEPS);
  const [activeThinkingText, setActiveThinkingText] = useState('');
  const [activeThinkingFallbackLines, setActiveThinkingFallbackLines] = useState(FALLBACK_THINKING_LINES);
  const [error, setError] = useState<string | null>(null);
  
  // History State
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<AppView>('chat');
  
  // Auth State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('hidden');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return window.localStorage.getItem('putra-theme') === 'dark' ? 'dark' : 'light';
  });
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const subscriptionBadge = 'BASIC';
  const isSendingRef = useRef(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const scrollToNewestUserMessage = useCallback(() => {
    window.requestAnimationFrame(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, []);

  useEffect(() => {
    const isDark = theme === 'dark';
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.body.style.colorScheme = isDark ? 'dark' : 'light';
    window.localStorage.setItem('putra-theme', theme);
  }, [theme]);

  useEffect(() => {
    const setViewportVars = () => {
      const layoutHeight = window.innerHeight;
      const visualViewport = window.visualViewport;
      const keyboardInset = visualViewport
        ? Math.max(0, layoutHeight - visualViewport.height - visualViewport.offsetTop)
        : 0;

      document.documentElement.style.setProperty('--app-height', `${layoutHeight}px`);
      document.documentElement.style.setProperty('--keyboard-inset', `${keyboardInset}px`);
      document.body.classList.toggle('keyboard-open', keyboardInset > 80);
      setIsKeyboardOpen(keyboardInset > 80);
    };

    setViewportVars();
    window.addEventListener('resize', setViewportVars);
    window.addEventListener('orientationchange', setViewportVars);
    window.visualViewport?.addEventListener('resize', setViewportVars);
    window.visualViewport?.addEventListener('scroll', setViewportVars);

    return () => {
      window.removeEventListener('resize', setViewportVars);
      window.removeEventListener('orientationchange', setViewportVars);
      window.visualViewport?.removeEventListener('resize', setViewportVars);
      window.visualViewport?.removeEventListener('scroll', setViewportVars);
      document.body.classList.remove('keyboard-open');
      document.documentElement.style.removeProperty('--keyboard-inset');
    };
  }, []);

  // Initialize Gemini and listen to Auth state
  useEffect(() => {
    geminiService.initChat();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          await ensureUserDocument(currentUser);
          setAuthMode(currentUser.phoneNumber ? 'hidden' : 'phone');
          await loadHistory(currentUser.uid);
        } catch (err) {
          setError(err instanceof Error ? `Kesalahan Firestore: ${err.message}` : 'Kesalahan Firestore: gagal memuat riwayat chat.');
        }
      } else {
        setChatHistory([]);
        setAuthMode('login');
      }
    });

    return () => unsubscribe();
  }, []);


  useEffect(() => {
    if (!isLoading) {
      setThinkingStep(0);
      setActiveThinkingText('');
      return;
    }

    const timer = window.setInterval(() => {
      setThinkingStep((step) => (step + 1) % activeThinkingSteps.length);
    }, 1600);

    return () => window.clearInterval(timer);
  }, [activeThinkingSteps, isLoading]);

  const loadHistory = async (uid: string) => {
    try {
      const history = await getUserChatHistory(uid);
      setChatHistory(history);
    } catch (err) {
      setChatHistory([]);
      throw err;
    }
  };

  const updateLocalHistory = useCallback((sessionId: string, title: string, sessionMessages: Message[]) => {
    const nextSession: ChatSession = {
      id: sessionId,
      title,
      updatedAt: new Date().toISOString(),
      messages: sessionMessages,
    };

    setChatHistory(prev => [
      nextSession,
      ...prev.filter(session => session.id !== sessionId),
    ]);
  }, []);

  const handleSendMessage = useCallback(async (text: string, attachments: Attachment[] = []) => {
    if (isSendingRef.current || isLoading || isTypingResponse) return;
    if (!text.trim() && attachments.length === 0) return;

    if (!user) {
      setAuthMode('login');
      setError('Silakan masuk atau buat akun sebelum mulai chat.');
      return;
    }

    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date(),
      attachments
    };

    const updatedMessagesAfterUser = [...messages, newUserMessage];
    const isVisionRequest = attachments.some((attachment) => attachment.mimeType.startsWith('image/'));
    const shouldCreateDocx = wantsDocxFile(text);
    isSendingRef.current = true;
    setActiveThinkingSteps(getThinkingSteps(text, attachments));
    setActiveThinkingFallbackLines(getFallbackThinkingLines(text));
    setActiveThinkingText('');
    setMessages(updatedMessagesAfterUser);
    scrollToNewestUserMessage();
    setIsLoading(true);
    setError(null);

    // Determine session ID and Title
    let sessionId = currentSessionId;
    let sessionTitle = '';
    
    if (!sessionId) {
      sessionId = Date.now().toString();
      setCurrentSessionId(sessionId);
      // Create title from text or attachment name
      if (text.trim()) {
        sessionTitle = text.slice(0, 30) + (text.length > 30 ? '...' : '');
      } else if (attachments.length > 0) {
        sessionTitle = `File: ${attachments[0].name}`;
      } else {
        sessionTitle = 'Chat Baru';
      }
    } else {
      // Find existing title from history
      const existingSession = chatHistory.find(s => s.id === sessionId);
      sessionTitle = existingSession ? existingSession.title : 'Sesi Chat';
    }

    updateLocalHistory(sessionId, sessionTitle, updatedMessagesAfterUser);

    if (user) {
      try {
        await saveChatSession(user.uid, sessionId, sessionTitle, updatedMessagesAfterUser);
      } catch (err) {
        setError(err instanceof Error ? `Gagal menyimpan ke Firestore: ${err.message}` : 'Gagal menyimpan ke Firestore.');
      }
    }

    try {
      const streamingMessageId = (Date.now() + 1).toString();
      let hasStreamingContent = false;
      let latestStreamText = '';

      const aiResponse = await geminiService.sendMessage(text, attachments, messages, {
        onThinking: setActiveThinkingText,
        onContent: (content) => {
          if (isVisionRequest) return;

          const cleanContent = content.trim();
          if (!cleanContent) return;

          hasStreamingContent = true;
          latestStreamText = cleanContent;
          setActiveThinkingText('');
          setIsLoading(false);
          setIsTypingResponse(false);
          setMessages((currentMessages) => {
            const streamingMessage: Message = {
              id: streamingMessageId,
              role: 'model',
              text: cleanContent,
              timestamp: new Date(),
              imageBase64: '',
              mode: isVisionRequest ? 'vision' : 'text',
              downloadDocx: shouldCreateDocx,
              docxTitle: shouldCreateDocx ? getDocxTitle(text) : undefined,
              animateTyping: false,
              isStreaming: true,
            };

            if (currentMessages.some((message) => message.id === streamingMessageId)) {
              return currentMessages.map((message) =>
                message.id === streamingMessageId ? { ...message, ...streamingMessage } : message,
              );
            }

            return [...currentMessages, streamingMessage];
          });
        },
      });
      
      const newModelMessage: Message = {
        id: streamingMessageId,
        role: 'model',
        text: aiResponse.text || latestStreamText,
        timestamp: new Date(),
        imageBase64: aiResponse.imageBase64,
        mode: aiResponse.mode,
        downloadDocx: shouldCreateDocx,
        docxTitle: shouldCreateDocx ? getDocxTitle(text) : undefined,
        animateTyping: !hasStreamingContent,
        isStreaming: false,
      };
      
      const finalMessages = [...updatedMessagesAfterUser, newModelMessage];
      setIsTypingResponse(!hasStreamingContent);
      setMessages((currentMessages) => {
        if (currentMessages.some((message) => message.id === streamingMessageId)) {
          return currentMessages.map((message) =>
            message.id === streamingMessageId ? newModelMessage : message,
          );
        }

        return [...currentMessages, newModelMessage];
      });
      updateLocalHistory(sessionId, sessionTitle, finalMessages);

      // Save to Firebase if logged in
      if (user && sessionId) {
        await saveChatSession(user.uid, sessionId, sessionTitle, finalMessages);
      }

      if (hasStreamingContent) {
        isSendingRef.current = false;
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak terduga.');
      setIsTypingResponse(false);
      isSendingRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [messages, currentSessionId, user, chatHistory, updateLocalHistory, isLoading, isTypingResponse, scrollToNewestUserMessage]);

  const handleTypingComplete = useCallback((messageId: string) => {
    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === messageId ? { ...message, animateTyping: false } : message,
      ),
    );
    setIsTypingResponse(false);
    isSendingRef.current = false;
  }, []);

  const handleNewChat = () => {
    geminiService.resetChat();
    setActiveView('chat');
    setMessages([]);
    setCurrentSessionId(null);
    setError(null);
    setIsTypingResponse(false);
    isSendingRef.current = false;
    setIsSidebarOpen(false);
  };

  const handleSelectSession = (session: ChatSession) => {
    geminiService.resetChat(); // Reset context for new session
    setActiveView('chat');
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setError(null);
    setIsTypingResponse(false);
    isSendingRef.current = false;
    setIsSidebarOpen(false);
  };

  const handleOpenPackages = () => {
    setActiveView('packages');
    setError(null);
    setIsSidebarOpen(false);
  };

  const handleOpenVoice = () => {
    setActiveView('voice');
    setError(null);
    setIsSidebarOpen(false);
  };

  const handleOpenPpt = () => {
    setActiveView('ppt');
    setError(null);
    setIsSidebarOpen(false);
  };

  const handleOpenConvert = (view: 'convert-word-pdf' | 'convert-ppt-pdf') => {
    setActiveView(view);
    setError(null);
    setIsSidebarOpen(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowUserMenu(false);
    handleNewChat();
  };

  const isEmptyChat = messages.length === 0;
  const username = user?.email?.split('@')[0] ?? '';
  const isDarkTheme = theme === 'dark';

  return (
    <div className={`putra-theme-root flex h-[var(--app-height,100dvh)] w-full overflow-hidden font-sans transition-colors ${isKeyboardOpen ? 'putra-keyboard-open' : ''} ${
      theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-800'
    }`}>
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onNewChat={handleNewChat}
        onOpenPackages={handleOpenPackages}
        onOpenVoice={handleOpenVoice}
        onOpenPpt={handleOpenPpt}
        onOpenConvert={handleOpenConvert}
        activeView={activeView}
        history={chatHistory}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        isLoggedIn={!!user}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-h-0 relative min-w-0">
        
        {/* Header */}
        <header className={`sticky top-0 z-10 flex items-center justify-between px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-md transition-colors md:px-6 md:pb-4 md:pt-[calc(env(safe-area-inset-top)+1rem)] ${
          isDarkTheme
            ? 'border-b border-slate-800 bg-slate-950/92'
            : 'border-b border-slate-100/70 bg-white/90'
        }`}>
          <div className="flex min-w-0 items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`rounded-full p-2 transition-colors ${
                isDarkTheme ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
              }`}
              aria-label="Buka riwayat chat"
            >
              <Menu size={24} />
            </button>
            <button
              type="button"
              className="min-w-0 flex items-center gap-2 text-left"
              onClick={handleNewChat}
            >
              <span className={`truncate text-lg font-semibold md:text-xl ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>
                PUTRA AI PLUS
              </span>
              <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold leading-4 text-blue-700">
                {subscriptionBadge}
              </span>
            </button>
          </div>
          
          <div className="flex items-center gap-3 relative">
            <button
              type="button"
              onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors ${
                isDarkTheme
                  ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
              title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
              aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user ? (
              <div className="relative">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium shadow-sm hover:bg-blue-700 transition-colors"
                >
                  {username ? username.charAt(0).toUpperCase() : <UserIcon size={18} />}
                </button>
                
                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-slate-100 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-100 px-4 py-2 dark:border-slate-800">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{user.email}</p>
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <LogOut size={16} />
                      Keluar
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </header>

        {/* Chat Area */}
        {activeView === 'packages' ? (
          <PutraPackages />
        ) : activeView === 'convert-word-pdf' ? (
          <PutraConvert mode="word-pdf" />
        ) : activeView === 'convert-ppt-pdf' ? (
          <PutraConvert mode="ppt-pdf" />
        ) : activeView === 'voice' ? (
          <SoreaVoice
            isLoggedIn={!!user}
            onRequireLogin={() => {
              setAuthMode('login');
              setError('Silakan masuk atau buat akun sebelum menggunakan Putra Voice.');
            }}
          />
        ) : activeView === 'ppt' ? (
          <PutraPpt />
        ) : (
        <main className={`relative min-h-0 flex-1 overflow-y-auto overscroll-contain transition-colors ${
          isDarkTheme ? 'bg-slate-950' : 'bg-white'
        } ${isEmptyChat ? '' : 'pb-64 md:pb-56'}`}>
          {isEmptyChat ? (
            // Empty State / Greeting
            <div className={`relative flex min-h-full items-center justify-center overflow-hidden px-4 py-10 transition-colors ${
              theme === 'dark' ? 'bg-slate-950' : 'bg-white'
            }`}>
              <div
                className={`pointer-events-none absolute inset-0 ${theme === 'dark' ? 'hidden' : 'block'}`}
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.18) 0%, rgba(147, 197, 253, 0.12) 28%, rgba(255, 255, 255, 0.78) 58%, #ffffff 100%)',
                }}
              />
              <div
                className={`pointer-events-none absolute inset-0 ${theme === 'dark' ? 'block' : 'hidden'}`}
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(37, 99, 235, 0.34) 0%, rgba(124, 58, 237, 0.22) 24%, rgba(15, 23, 42, 0.96) 52%, #020617 100%)',
                }}
              />
              <div className={`relative z-10 flex w-full max-w-[760px] flex-col items-center gap-7 transition-transform sm:-translate-y-5 ${isKeyboardOpen ? '-translate-y-24' : '-translate-y-8'}`}>
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="relative">
                    <div className={`absolute inset-[-18px] rounded-full blur-2xl ${
                      isDarkTheme ? 'bg-blue-500/20' : 'bg-blue-400/20'
                    }`} />
                    <div className={`relative inline-flex h-16 w-16 items-center justify-center rounded-full shadow-sm ring-1 ${
                      isDarkTheme ? 'bg-slate-900/95 ring-slate-700' : 'bg-white/90 ring-blue-100'
                    }`}>
                      <img
                        src={APP_ICON_URL}
                        alt="PUTRA AI STUDIO"
                        className="h-10 w-10 object-contain"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h2 className={`text-balance text-[30px] font-semibold leading-tight tracking-normal sm:text-5xl ${
                      isDarkTheme ? 'text-slate-50' : 'text-slate-800'
                    }`}>
                      Mau mulai dari apa hari ini?
                    </h2>
                    {username && (
                      <div className="flex justify-center">
                        <span className={`max-w-[80vw] truncate rounded-full px-4 py-1.5 text-sm font-semibold shadow-sm ring-1 sm:text-base ${
                          isDarkTheme
                            ? 'bg-slate-900/80 text-blue-200 ring-slate-700'
                            : 'bg-white/80 text-blue-700 ring-blue-100'
                        }`}>
                          {username}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-full max-w-[720px]">
                  <ChatInput
                    onSendMessage={handleSendMessage}
                    isLoading={isLoading || isTypingResponse || !user}
                    variant="hero"
                    placeholder="Tulis pesan untuk PUTRA AI"
                    theme={theme}
                  />
                  {error && <ErrorNotice error={error} compact isDark={isDarkTheme} />}
                </div>
              </div>
            </div>
          ) : (
            // Messages List
            <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} onTypingComplete={handleTypingComplete} />
              ))}
              
              {isLoading && (
                isImageGenerationStepSet(activeThinkingSteps) ? (
                  <ImageGenerationLoader step={activeThinkingSteps[thinkingStep]} />
                ) : (
                  <ThinkingLoader
                    step={activeThinkingSteps[thinkingStep]}
                    steps={activeThinkingSteps}
                    liveThinking={activeThinkingText}
                    fallbackLines={activeThinkingFallbackLines}
                  />
                )
              )}
              
              {error && <ErrorNotice error={error} isDark={isDarkTheme} />}
              
              <div ref={chatBottomRef} className="h-36 md:h-32" />
            </div>
          )}
        </main>
        )}

        {/* Input Area Fixed at Bottom */}
        {activeView === 'chat' && !isEmptyChat && (
        <div
          style={{ bottom: 'var(--keyboard-inset, 0px)' }}
          className={`absolute left-0 w-full bg-gradient-to-t px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-10 transition-[background-color,opacity,bottom] md:px-6 ${
            isDarkTheme
              ? 'from-slate-950 via-slate-950 to-transparent'
              : 'from-white via-white to-transparent'
          }`}
        >
          <div className="max-w-3xl mx-auto">
            <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading || isTypingResponse || !user} theme={theme} />
            <div className="text-center mt-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                &copy; 2026 PUTRA AI STUDIO.{' '}
                <a
                  href="https://www.putraaistudioapikey.site/#privacy"
                  className="font-medium text-slate-600 underline underline-offset-2 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300"
                >
                  Kebijakan & Privasi
                </a>
              </p>
            </div>
          </div>
        </div>
        )}

      </div>

      {/* Auth Modal */}
      <AuthModal 
        mode={authMode} 
        onClose={() => user?.phoneNumber && setAuthMode('hidden')} 
        onChangeMode={setAuthMode} 
        canClose={!!user?.phoneNumber}
      />

    </div>
  );
};

export default App;



