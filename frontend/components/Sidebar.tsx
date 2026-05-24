import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, KeyRound, MessageSquare, Package, Plus, X } from 'lucide-react';
import { ChatSession } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  history: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  isLoggedIn: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  onClose, 
  onNewChat, 
  history, 
  currentSessionId, 
  onSelectSession,
  isLoggedIn,
}) => {
  const [showAllHistory, setShowAllHistory] = useState(false);
  const visibleHistory = useMemo(
    () => showAllHistory ? history : history.slice(0, 5),
    [history, showAllHistory]
  );
  const hasMoreHistory = history.length > 5;
  const navLinks = [
    { label: 'Paket', href: 'https://www.putraaistudioapikey.site/#home', icon: Package },
    { label: 'API Key', href: 'https://www.putraaistudioapikey.site/', icon: KeyRound },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-20"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-[min(86vw,320px)] bg-[#f6f8fc] shadow-2xl shadow-slate-900/15 transform transition-transform duration-300 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <button 
            onClick={onNewChat}
            className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 px-4 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm"
          >
            <Plus size={18} />
            Chat baru
          </button>
          <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full" aria-label="Tutup riwayat chat">
            <X size={20} />
          </button>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3">Menu</h3>
            <div className="space-y-1">
              {navLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-left text-slate-700 hover:bg-slate-200/70 transition-colors"
                  >
                    <Icon size={16} className="flex-shrink-0 opacity-75" />
                    <span className="text-sm font-medium truncate">{item.label}</span>
                  </a>
                );
              })}
            </div>
          </div>

          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3">Riwayat</h3>
          
          {!isLoggedIn ? (
            <div className="px-3 py-4 text-center bg-white/50 rounded-xl border border-slate-200/50">
              <p className="text-sm text-slate-600">Silakan masuk untuk menggunakan riwayat chat.</p>
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-slate-500 px-3">Belum ada riwayat chat.</p>
          ) : (
            <div className="space-y-1">
              {visibleHistory.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSelectSession(session)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-left transition-colors ${
                    currentSessionId === session.id 
                      ? 'bg-blue-100 text-blue-900' 
                      : 'hover:bg-slate-200/70 text-slate-700'
                  }`}
                >
                  <MessageSquare size={16} className="flex-shrink-0 opacity-70" />
                  <span className="text-sm truncate">{session.title}</span>
                </button>
              ))}

              {hasMoreHistory && (
                <button
                  onClick={() => setShowAllHistory((value) => !value)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-200/70 transition-colors"
                >
                  {showAllHistory ? (
                    <>
                      <ChevronUp size={16} />
                      Tutup sebagian riwayat
                    </>
                  ) : (
                    <>
                      <ChevronDown size={16} />
                      Lihat semua riwayat
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </>
  );
};
