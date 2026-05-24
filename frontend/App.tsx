import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, ChatSession, Attachment } from './types';
import { geminiService } from './services/geminiService';
import { auth, ensureUserDocument, getUserChatHistory, saveChatSession } from './services/firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { SuggestedPrompts } from './components/SuggestedPrompts';
import { Sidebar } from './components/Sidebar';
import { AuthModal, AuthMode } from './components/AuthModal';
import { Menu, Sparkles, LogOut, User as UserIcon } from 'lucide-react';

const THINKING_STEPS = [
  'Memahami permintaan',
  'Menentukan tujuan',
  'Menyusun jawaban',
];

const App: React.FC = () => {
  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // History State
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Auth State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('hidden');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const subscriptionBadge = 'BASIC';

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);

  // Initialize Gemini and listen to Auth state
  useEffect(() => {
    geminiService.initChat();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setAuthMode('hidden');
        try {
          await ensureUserDocument(currentUser);
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
      setThinkingStep((step) => (step + 1) % THINKING_STEPS.length);
    }, 1600);

    return () => window.clearInterval(timer);
  }, [isLoading]);

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
    if (isSendingRef.current || isLoading) return;
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
    isSendingRef.current = true;
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
      const aiResponse = await geminiService.sendMessage(text, attachments);
      
      const newModelMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: aiResponse.text,
        timestamp: new Date(),
        imageBase64: aiResponse.imageBase64,
        mode: aiResponse.mode,
        animateTyping: true,
      };
      
      const finalMessages = [...updatedMessagesAfterUser, newModelMessage];
      setMessages(finalMessages);
      updateLocalHistory(sessionId, sessionTitle, finalMessages);

      // Save to Firebase if logged in
      if (user && sessionId) {
        await saveChatSession(user.uid, sessionId, sessionTitle, finalMessages);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak terduga.');
    } finally {
      isSendingRef.current = false;
      setIsLoading(false);
    }
  }, [messages, currentSessionId, user, chatHistory, updateLocalHistory, isLoading]);

  const handleNewChat = () => {
    geminiService.resetChat();
    setMessages([]);
    setCurrentSessionId(null);
    setError(null);
    setIsSidebarOpen(false);
  };

  const handleSelectSession = (session: ChatSession) => {
    geminiService.resetChat(); // Reset context for new session
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setError(null);
    setIsSidebarOpen(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowUserMenu(false);
    handleNewChat();
  };

  return (
    <div className="flex h-screen w-full bg-white font-sans overflow-hidden">
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onNewChat={handleNewChat}
        history={chatHistory}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        isLoggedIn={!!user}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-slate-100/70">
          <div className="flex min-w-0 items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
              aria-label="Buka riwayat chat"
            >
              <Menu size={24} />
            </button>
            <button
              type="button"
              className="min-w-0 flex items-center gap-2 text-left"
              onClick={handleNewChat}
            >
              <span className="truncate text-lg md:text-xl font-semibold text-slate-600">
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
                  {user.email ? user.email.charAt(0).toUpperCase() : <UserIcon size={18} />}
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
        <main className="flex-1 overflow-y-auto pb-48 md:pb-44">
          {messages.length === 0 ? (
            // Empty State / Greeting
            <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 md:pt-16 flex min-h-full flex-col">
              <div className="mb-8 md:mb-10 max-w-3xl">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-red-500 text-white shadow-sm">
                  <Sparkles size={20} className="fill-white" />
                </div>
                <h2 className="text-4xl md:text-6xl font-semibold tracking-normal leading-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-violet-500 to-rose-500">
                  Halo.
                </h2>
                <h2 className="text-3xl md:text-5xl font-semibold tracking-normal leading-tight text-slate-400">
                  Apa yang ingin Anda buat atau bahas hari ini?
                </h2>
              </div>
              <SuggestedPrompts onSelectPrompt={(text) => handleSendMessage(text, [])} disabled={isLoading || !user} />
            </div>
          ) : (
            // Messages List
            <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              
              {isLoading && (
                <div className="flex w-full mb-8 justify-start">
                  <div className="flex max-w-[90%] flex-row items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-red-500 flex items-center justify-center text-white shadow-sm animate-pulse">
                        <Sparkles size={16} className="fill-white" />
                      </div>
                    </div>
                    <div className="flex-1 py-1.5">
                      <div className="inline-flex items-center gap-3 rounded-full bg-slate-50 px-3.5 py-2 text-slate-600 shadow-sm ring-1 ring-slate-200/70">
                        <div className="flex items-center gap-1.5" aria-hidden="true">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                        <span className="text-sm font-medium">
                          {THINKING_STEPS[thinkingStep]}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="mb-8 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm text-center">
                  {error}
                </div>
              )}
              
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </main>

        {/* Input Area Fixed at Bottom */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-white via-white to-transparent pt-10 pb-4 px-3 md:px-6">
          <div className="max-w-3xl mx-auto">
            <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading || !user} />
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

      </div>

      {/* Auth Modal */}
      <AuthModal 
        mode={authMode} 
        onClose={() => user && setAuthMode('hidden')} 
        onChangeMode={setAuthMode} 
        canClose={!!user}
      />

    </div>
  );
};

export default App;
