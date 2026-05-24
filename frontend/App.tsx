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

const App: React.FC = () => {
  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // History State
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Auth State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('hidden');
  const [showUserMenu, setShowUserMenu] = useState(false);

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
          setError(err instanceof Error ? `Firestore error: ${err.message}` : 'Firestore error: failed to load chat history.');
        }
      } else {
        setChatHistory([]);
        setAuthMode('login');
      }
    });

    // Auto-close sidebar on mobile initially
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }

    return () => unsubscribe();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

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
      setError('Please sign in or create an account before chatting.');
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
        sessionTitle = 'New Chat';
      }
    } else {
      // Find existing title from history
      const existingSession = chatHistory.find(s => s.id === sessionId);
      sessionTitle = existingSession ? existingSession.title : 'Chat Session';
    }

    updateLocalHistory(sessionId, sessionTitle, updatedMessagesAfterUser);

    if (user) {
      try {
        await saveChatSession(user.uid, sessionId, sessionTitle, updatedMessagesAfterUser);
      } catch (err) {
        setError(err instanceof Error ? `Firestore save failed: ${err.message}` : 'Firestore save failed.');
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
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
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
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleSelectSession = (session: ChatSession) => {
    geminiService.resetChat(); // Reset context for new session
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setError(null);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
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
        <header className="flex items-center justify-between p-4 sticky top-0 bg-white/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-medium text-slate-600 flex items-center gap-2 cursor-pointer" onClick={handleNewChat}>
              Putra Ai
            </h1>
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
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto pb-36">
          {messages.length === 0 ? (
            // Empty State / Greeting
            <div className="max-w-4xl mx-auto px-6 pt-12 md:pt-20 flex flex-col h-full">
              <div className="mb-12">
                <h2 className="text-[40px] md:text-[56px] font-semibold tracking-tight leading-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-red-500">
                  Hello,
                </h2>
                <h2 className="text-[40px] md:text-[56px] font-semibold tracking-tight leading-tight text-[#c4c7c5]">
                  How can I help you today?
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
                    <div className="flex-1 py-2">
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
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
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-white via-white to-transparent pt-10 pb-4 px-4 md:px-6">
          <div className="max-w-3xl mx-auto">
            <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading || !user} />
            <div className="text-center mt-3">
              <p className="text-xs text-slate-500">
                Putra Ai may display inaccurate info, including about people, so double-check its responses.
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
