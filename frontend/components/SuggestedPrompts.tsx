import React from 'react';
import { SUGGESTED_PROMPTS } from '../constants';
import { Compass, Lightbulb, Code, TrendingUp } from 'lucide-react';

interface SuggestedPromptsProps {
  onSelectPrompt: (text: string) => void;
  disabled: boolean;
}

export const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({ onSelectPrompt, disabled }) => {
  
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'compass': return <Compass size={20} className="text-slate-500" />;
      case 'lightbulb': return <Lightbulb size={20} className="text-slate-500" />;
      case 'code': return <Code size={20} className="text-slate-500" />;
      case 'trending': return <TrendingUp size={20} className="text-slate-500" />;
      default: return <Lightbulb size={20} className="text-slate-500" />;
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 w-full">
      {SUGGESTED_PROMPTS.map((prompt) => (
        <button
          key={prompt.id}
          onClick={() => onSelectPrompt(prompt.text)}
          disabled={disabled}
          className="flex flex-col justify-between min-h-32 md:min-h-36 p-4 rounded-2xl bg-[#f3f6fb] hover:bg-[#e8eef7] border border-slate-200/70 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <p className="text-[15px] text-slate-700 leading-snug line-clamp-3">
            {prompt.text}
          </p>
          <div className="flex justify-end w-full mt-4">
            <div className="p-2 bg-white rounded-full shadow-sm opacity-80 group-hover:opacity-100 transition-opacity">
              {getIcon(prompt.iconName)}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};
