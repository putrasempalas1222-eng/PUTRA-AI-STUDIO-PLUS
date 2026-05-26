import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, FileText, KeyRound, MessageSquare, Mic2, Package, Plus, Repeat2, X } from 'lucide-react';
import { ChatSession } from '../types';

export type AppView = 'chat' | 'voice' | 'ppt' | 'packages' | 'convert-word-pdf' | 'convert-ppt-pdf';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onOpenPackages: () => void;
  onOpenVoice: () => void;
  onOpenPpt: () => void;
  onOpenConvert: (view: 'convert-word-pdf' | 'convert-ppt-pdf') => void;
  activeView: AppView;
  history: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  isLoggedIn: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  onClose, 
  onNewChat, 
  onOpenPackages,
  onOpenVoice,
  onOpenPpt,
  onOpenConvert,
  activeView,
  history, 
  currentSessionId, 
  onSelectSession,
  isLoggedIn,
}) => {
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const visibleHistory = useMemo(
    () => showAllHistory ? history : history.slice(0, 5),
    [history, showAllHistory]
  );
  const hasMoreHistory = history.length > 5;
  const isConvertActive = activeView === 'convert-word-pdf' || activeView === 'convert-ppt-pdf';
  const navLinks = [
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
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3">Menu Utama</h3>
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
              <button
                type="button"
                onClick={onOpenPackages}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-left transition-colors ${
                  activeView === 'packages'
                    ? 'bg-blue-100 text-blue-900'
                    : 'text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                <Package size={16} className="flex-shrink-0 opacity-75" />
                <span className="text-sm font-medium truncate">Paket</span>
              </button>
            </div>
          </div>

          <div className="mb-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3">Fitur AI</h3>
            <div className="space-y-1">
              <button
                type="button"
                onClick={onOpenVoice}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-left transition-colors ${
                  activeView === 'voice'
                    ? 'bg-blue-100 text-blue-900'
                    : 'text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                <Mic2 size={16} className="flex-shrink-0 opacity-75" />
                <span className="text-sm font-medium truncate">Putra Voice</span>
              </button>
              <button
                type="button"
                onClick={onOpenPpt}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-left transition-colors ${
                  activeView === 'ppt'
                    ? 'bg-blue-100 text-blue-900'
                    : 'text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                <FileText size={16} className="flex-shrink-0 opacity-75" />
                <span className="text-sm font-medium truncate">Putra PPT</span>
              </button>
              <div>
                <button
                  type="button"
                  onClick={() => setIsConvertOpen((value) => !value)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-left transition-colors ${
                    isConvertActive
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  <Repeat2 size={16} className="flex-shrink-0 opacity-75" />
                  <span className="text-sm font-medium truncate">Putra Convers</span>
                  {isConvertOpen ? (
                    <ChevronUp size={15} className="ml-auto opacity-70" />
                  ) : (
                    <ChevronDown size={15} className="ml-auto opacity-70" />
                  )}
                </button>
                {isConvertOpen && (
                  <div className="mt-1 space-y-1 border-l border-slate-200/80 pl-5 ml-5">
                    <button
                      type="button"
                      onClick={() => onOpenConvert('convert-word-pdf')}
                      className={`w-full rounded-full px-3 py-2 text-left text-sm font-medium transition-colors ${
                        activeView === 'convert-word-pdf'
                          ? 'bg-white text-blue-800 shadow-sm'
                          : 'text-slate-600 hover:bg-white/70'
                      }`}
                    >
                      Word ke PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenConvert('convert-ppt-pdf')}
                      className={`w-full rounded-full px-3 py-2 text-left text-sm font-medium transition-colors ${
                        activeView === 'convert-ppt-pdf'
                          ? 'bg-white text-blue-800 shadow-sm'
                          : 'text-slate-600 hover:bg-white/70'
                      }`}
                    >
                      PPT ke PDF
                    </button>
                  </div>
                )}
              </div>
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
