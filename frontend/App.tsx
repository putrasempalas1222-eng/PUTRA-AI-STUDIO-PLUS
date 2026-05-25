import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, ChatSession, Attachment } from './types';
import { geminiService } from './services/geminiService';
import { auth, ensureUserDocument, getUserChatHistory, saveChatSession } from './services/firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Sidebar, AppView } from './components/Sidebar';
import { SoreaVoice } from './components/SoreaVoice';
import { PutraPpt } from './components/PutraPpt';
import { AuthModal, AuthMode } from './components/AuthModal';
import { Menu, Sparkles, LogOut, User as UserIcon } from 'lucide-react';

const THINKING_STEPS = [
  'Memahami permintaan',
  'Menentukan tujuan',
  'Menyusun jawaban',
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

const APP_ICON_URL = 'https://firebasestorage.googleapis.com/v0/b/play-integrity-2adpr7x4a8xhyex.firebasestorage.app/o/Desain_tanpa_judul-removebg-preview.png?alt=media&token=d5be2a46-6352-48a2-89ae-e89574279f09';

const IMAGE_GENERATION_KEYWORDS = [
  'buat gambar',
  'buatkan gambar',
  'generate gambar',
  'hasilkan gambar',
  'bikin gambar',
  'gambar',
  'ilustrasi',
  'poster',
  'logo',
  'desain',
  'render',
  'draw',
  'generate image',
  'create image',
];

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
  if (IMAGE_GENERATION_KEYWORDS.some((keyword) => normalizedText.includes(keyword))) {
    return IMAGE_GENERATION_STEPS;
  }

  return THINKING_STEPS;
};

const isImageGenerationStepSet = (steps: string[]) => steps === IMAGE_GENERATION_STEPS;

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

      <div className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Membuat gambar</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{step}</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Sparkles size={17} />
          </div>
        </div>

        <div className="relative h-64 overflow-hidden bg-slate-50">
          <div
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(37, 99, 235, 0.20) 1.2px, transparent 1.2px)',
              backgroundSize: '18px 18px',
              maskImage:
                'radial-gradient(circle at 34% 55%, black 0%, black 34%, transparent 68%)',
              WebkitMaskImage:
                'radial-gradient(circle at 34% 55%, black 0%, black 34%, transparent 68%)',
            }}
          />
          <div className="absolute left-8 top-8 h-28 w-28 rounded-full border border-blue-200 bg-blue-100/50 blur-sm" />
          <div className="absolute bottom-8 right-9 h-24 w-24 rounded-full border border-rose-200 bg-rose-100/50 blur-sm" />
          <div className="absolute inset-x-8 bottom-8 overflow-hidden rounded-full bg-white/90 p-1 shadow-sm ring-1 ring-slate-200">
            <div className="h-2 w-2/3 animate-pulse rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-rose-500" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 16 }).map((_, index) => (
                <span
                  key={index}
                  className="h-2 w-2 rounded-full bg-slate-400/60 animate-pulse"
                  style={{ animationDelay: `${index * 65}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
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
  const [error, setError] = useState<string | null>(null);
  
  // History State
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<AppView>('chat');
  
  // Auth State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('hidden');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const subscriptionBadge = 'BASIC';

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);

  useEffect(() => {
    const setAppHeight = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${viewportHeight}px`);
    };

    setAppHeight();
    window.addEventListener('resize', setAppHeight);
    window.visualViewport?.addEventListener('resize', setAppHeight);

    return () => {
      window.removeEventListener('resize', setAppHeight);
      window.visualViewport?.removeEventListener('resize', setAppHeight);
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

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      setThinkingStep(0);
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
    const shouldCreateDocx = wantsDocxFile(text);
    isSendingRef.current = true;
    setActiveThinkingSteps(getThinkingSteps(text, attachments));
    setMessages(updatedMessagesAfterUser);
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
      const aiResponse = await geminiService.sendMessage(text, attachments, messages);
      
      const newModelMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: aiResponse.text,
        timestamp: new Date(),
        imageBase64: aiResponse.imageBase64,
        mode: aiResponse.mode,
        downloadDocx: shouldCreateDocx,
        docxTitle: shouldCreateDocx ? getDocxTitle(text) : undefined,
        animateTyping: true,
      };
      
      const finalMessages = [...updatedMessagesAfterUser, newModelMessage];
      setIsTypingResponse(true);
      setMessages(finalMessages);
      updateLocalHistory(sessionId, sessionTitle, finalMessages);

      // Save to Firebase if logged in
      if (user && sessionId) {
        await saveChatSession(user.uid, sessionId, sessionTitle, finalMessages);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak terduga.');
      setIsTypingResponse(false);
      isSendingRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [messages, currentSessionId, user, chatHistory, updateLocalHistory, isLoading, isTypingResponse]);

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

  const handleLogout = async () => {
    await signOut(auth);
    setShowUserMenu(false);
    handleNewChat();
  };

  const isEmptyChat = messages.length === 0;
  const username = user?.email?.split('@')[0] ?? '';

  return (
    <div className="flex h-[var(--app-height,100dvh)] w-full overflow-hidden bg-white font-sans">
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onNewChat={handleNewChat}
        onOpenVoice={handleOpenVoice}
        onOpenPpt={handleOpenPpt}
        activeView={activeView}
        history={chatHistory}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        isLoggedIn={!!user}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-h-0 relative min-w-0">
        
        {/* Header */}
        <header className={`sticky top-0 z-10 flex items-center justify-between px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-md md:px-6 md:pb-4 md:pt-[calc(env(safe-area-inset-top)+1rem)] ${
          isEmptyChat
            ? 'border-b border-slate-100/70 bg-white/90'
            : 'border-b border-slate-100/70 bg-white/90'
        }`}>
          <div className="flex min-w-0 items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`rounded-full p-2 transition-colors ${
                isEmptyChat ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-600 hover:bg-slate-100'
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
              <span className={`truncate text-lg font-semibold md:text-xl ${isEmptyChat ? 'text-slate-600' : 'text-slate-600'}`}>
                PUTRA AI PLUS
              </span>
              <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold leading-4 text-blue-700">
                {subscriptionBadge}
              </span>
            </button>
          </div>
          
          <div className="flex items-center gap-3 relative">
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
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-sm font-medium text-slate-800 truncate">{user.email}</p>
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-50 flex items-center gap-2"
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
        {activeView === 'voice' ? (
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
        <main className={`relative flex-1 min-h-0 overflow-y-auto overscroll-contain ${isEmptyChat ? '' : 'pb-64 md:pb-56'}`}>
          {isEmptyChat ? (
            // Empty State / Greeting
            <div className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-10">
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.18) 0%, rgba(147, 197, 253, 0.12) 28%, rgba(255, 255, 255, 0.78) 58%, #ffffff 100%)',
                }}
              />
              <div className="relative z-10 flex w-full max-w-[660px] -translate-y-10 flex-col items-center gap-8 sm:-translate-y-6">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 ring-1 ring-blue-100">
                    <img
                      src={APP_ICON_URL}
                      alt="PUTRA AI STUDIO"
                      className="h-9 w-9 object-contain"
                    />
                  </div>
                  <h2 className="text-[28px] font-medium leading-tight tracking-normal text-slate-700 sm:text-4xl">
                    Sebaiknya kita mulai dari mana?
                  </h2>
                  {username && (
                    <p className="max-w-[80vw] truncate bg-gradient-to-r from-blue-600 via-violet-500 to-rose-500 bg-clip-text text-xl font-semibold leading-tight text-transparent sm:text-2xl">
                      {username}
                    </p>
                  )}
                </div>
                <div className="w-full">
                  <ChatInput
                    onSendMessage={handleSendMessage}
                    isLoading={isLoading || isTypingResponse || !user}
                    variant="hero"
                    placeholder="Minta PUTRA AI"
                  />
                  {error && (
                    <div className="mx-auto mt-4 max-w-xl rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-center text-sm text-red-100">
                      {error}
                    </div>
                  )}
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
                  <div className="flex w-full mb-8 justify-start">
                  <div className="flex max-w-[90%] flex-row items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 shadow-sm ring-1 ring-blue-100 animate-pulse">
                        <img
                          src={APP_ICON_URL}
                          alt="PUTRA AI STUDIO"
                          className="h-6 w-6 object-contain"
                        />
                      </div>
                    </div>
                    <div className="flex-1 py-1.5">
                      <div className="inline-flex items-center gap-3 px-1 py-2 text-slate-600">
                        <div className="flex items-center gap-1.5" aria-hidden="true">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                        <span className="text-sm font-medium">
                          {activeThinkingSteps[thinkingStep]}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                )
              )}
              
              {error && (
                <div className="mb-8 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm text-center">
                  {error}
                </div>
              )}
              
              <div ref={messagesEndRef} className="h-36 md:h-32" />
            </div>
          )}
        </main>
        )}

        {/* Input Area Fixed at Bottom */}
        {activeView === 'chat' && !isEmptyChat && (
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-white via-white to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-10 md:px-6">
          <div className="max-w-3xl mx-auto">
            <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading || isTypingResponse || !user} />
            <div className="text-center mt-3">
              <p className="text-xs text-slate-500">
                © 2026 PUTRA AI STUDIO.{' '}
                <a
                  href="https://www.putraaistudioapikey.site/#privacy"
                  className="font-medium text-slate-600 underline underline-offset-2 hover:text-blue-600"
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
