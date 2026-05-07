import React, { useState } from 'react';
import { Wand2, Loader2 } from 'lucide-react';

interface TransformationPanelProps {
  onTransform: (prompt: string) => void;
  isProcessing: boolean;
  placeholder?: string;
  isMaskMode?: boolean;
  language?: 'en' | 'de';
}

const SUGGESTIONS_EN = [
  { label: '🪑 Bench', value: 'add a modern wooden park bench' },
  { label: '🌳 Oak Tree', value: 'add a mature oak tree with green leaves' },
  { label: '🚲 Bike Rack', value: 'add a metal bicycle rack' },
  { label: '🌸 Planter', value: 'add a large ceramic pot with colorful flowers' },
  { label: '🗑️ Trash Can', value: 'add a sleek designer trash bin' },
  { label: '🧍 Pedestrian', value: 'add a person walking' },
  { label: '💡 Street Light', value: 'add a modern LED street lamp' },
];

const SUGGESTIONS_DE = [
  { label: '🪑 Bank', value: 'eine moderne parkbank aus holz hinzufügen' },
  { label: '🌳 Eiche', value: 'eine große eiche mit grünen blättern hinzufügen' },
  { label: '🚲 Radständer', value: 'einen fahrradständer aus metall hinzufügen' },
  { label: '🌸 Pflanzkübel', value: 'einen großen keramiktopf mit bunten blumen hinzufügen' },
  { label: '🗑️ Mülleimer', value: 'einen modernen designer-mülleimer hinzufügen' },
  { label: '🧍 Fußgänger', value: 'eine gehende person hinzufügen' },
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onTransform(prompt);
      setPrompt('');
    }
  };

  const addSuggestion = (val: string) => {
    setPrompt(prev => prev ? `${prev}, ${val}` : val);
  };

  return (
    <div className="bg-white border-2 border-black p-0">
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <h3 className="text-[10px] font-black flex items-center gap-2">
          <Wand2 className="w-3 h-3" /> {strings.instruction} {isMaskMode && <span className="text-[#ffb2c1]">{strings.masked}</span>}
        </h3>
        {prompt && (
          <button 
            type="button" 
            onClick={() => setPrompt('')}
            className="text-[9px] font-black hover:text-[#ffb2c1]"
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
          className="w-full bg-gray-50 text-black text-sm p-4 border-2 border-black focus:bg-white outline-none transition-all resize-none h-28 font-bold tracking-tight placeholder:text-black/10"
          disabled={isProcessing}
        />
        
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => addSuggestion(s.value)}
              className="px-3 h-8 bg-white border-2 border-black text-[9px] font-black hover:bg-black hover:text-white transition-all"
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={!prompt.trim() || isProcessing}
          className="w-full bg-black text-white h-14 border-2 border-black font-black hover:bg-[#ffb2c1] hover:text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50"
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
