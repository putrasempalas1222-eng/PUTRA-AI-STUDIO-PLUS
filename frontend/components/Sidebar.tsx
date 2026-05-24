import React from 'react';
import { MessageSquare, Plus, X } from 'lucide-react';
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
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-20 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-30 w-72 bg-[#f0f4f9] transform transition-transform duration-300 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:hidden md:w-0'}
      `}>
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <button 
            onClick={onNewChat}
            className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 px-4 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm"
          >
            <Plus size={18} />
            New chat
          </button>
          <button onClick={onClose} className="md:hidden p-2 text-slate-500 hover:bg-slate-200 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3">Recent</h3>
          
          {!isLoggedIn ? (
            <div className="px-3 py-4 text-center bg-white/50 rounded-xl border border-slate-200/50">
              <p className="text-sm text-slate-600">Please sign in to use chat history.</p>
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-slate-500 px-3">No recent chats.</p>
          ) : (
            <div className="space-y-1">
              {history.map((session) => (
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
            </div>
          )}
        </div>

      </div>
    </>
  );
};
