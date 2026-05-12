import React, { useState } from 'react';
import { Wand2, Loader2 } from 'lucide-react';

interface TransformationPanelProps {
  onTransform: (prompt: string) => void | Promise<void>;
  isProcessing: boolean;
  placeholder?: string;
  isMaskMode?: boolean;
  language?: 'en' | 'de';
}

const SUGGESTIONS_EN = [
  { label: '🌳 Tree', value: 'add a mature street tree with green foliage' },
  { label: '🌼 Flower garden', value: 'add a small street-side flower garden with mixed blooms in a low planting bed' },
  { label: '🗑️ Orange bin', value: 'add Berlin-style orange public litter bins beside street trees, realistic BSR-type street waste containers' },
  { label: '💡 Street Light', value: 'add a modern LED street lamp' },
];

const SUGGESTIONS_DE = [
  { label: '🌳 Baum', value: 'einen ausgewachsenen straßenbaum mit grünem laub hinzufügen' },
  { label: '🌼 Blumengarten', value: 'einen kleinen straßenrand-blumengarten mit bunten stauden in einer flachen beetanlage hinzufügen' },
  { label: '🗑️ Orange Tonne', value: 'typische berliner orangefarbene öffentliche mülltonnen (bsr-art) neben straßenbäumen hinzufügen' },
  { label: '💡 Straßenlampe', value: 'eine moderne led-straßenlaterne hinzufügen' },
];

export const TransformationPanel: React.FC<TransformationPanelProps> = ({ 
  onTransform, 
  isProcessing,
  placeholder = "Describe how to change the image...",
  isMaskMode = false,
  language = 'en'
}) => {
  const [prompt, setPrompt] = useState('');
  const suggestions = language === 'en' ? SUGGESTIONS_EN : SUGGESTIONS_DE;
  
  const strings = {
    en: {
      instruction: "AI Instruction",
      masked: "(Targeting Mask)",
      clear: "Clear",
      synthesizing: "Synthesizing...",
      apply: "Apply Changes"
    },
    de: {
      instruction: "KI-Anweisung",
      masked: "(Bereich ausgewählt)",
      clear: "Leeren",
      synthesizing: "Synthese...",
      apply: "Anwenden"
    }
  }[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || isProcessing) return;
    try {
      await onTransform(trimmed);
      setPrompt('');
    } catch {
      /* error UI handled in App */
    }
  };

  const addSuggestion = (val: string) => {
    setPrompt(prev => prev ? `${prev}, ${val}` : val);
  };

  return (
    <div className="bg-white border-2 border-eb-900 p-0">
      <div className="bg-tsb text-eb-50 px-4 py-2 flex items-center justify-between">
        <h3 className="text-[10px] font-black flex items-center gap-2">
          <Wand2 className="w-3 h-3" /> {strings.instruction} {isMaskMode && <span className="text-coral-100">{strings.masked}</span>}
        </h3>
        {prompt && (
          <button 
            type="button" 
            onClick={() => setPrompt('')}
            className="text-[9px] font-black hover:text-coral-100"
          >
            {strings.clear}
          </button>
        )}
      </div>
      <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-gray-50 text-eb-900 text-sm p-4 border-2 border-eb-900 focus:bg-white outline-none transition-all resize-none h-28 font-bold tracking-tight placeholder:text-eb-900/10"
          disabled={isProcessing}
        />
        
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => addSuggestion(s.value)}
              className="px-3 h-8 bg-white border-2 border-eb-900 text-[9px] font-black hover:bg-eb-900 hover:text-eb-50 transition-all"
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={!prompt.trim() || isProcessing}
          className="w-full bg-eb-900 text-eb-50 h-14 border-2 border-eb-900 font-black hover:bg-coral-100 hover:text-eb-900 shadow-[4px_4px_0px_0px_rgba(32,32,27,0.2)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> {strings.synthesizing}
            </span>
          ) : (
            strings.apply
          )}
        </button>
      </form>
    </div>
  );
};
