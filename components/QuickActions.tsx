import React from 'react';
import { Trees, Droplets, Ban, Sun, Armchair, Bike } from 'lucide-react';
import { TransformationType } from '../types';

interface QuickActionsProps {
  onAction: (prompt: string) => void | Promise<void>;
  disabled: boolean;
  language?: 'en' | 'de';
  /** In Area Edit, presets need a painted mask first — otherwise the run aborts. */
  presetsBlocked?: boolean;
}

const swallowAsync = (p: Promise<void> | void) => {
  if (p && typeof (p as Promise<void>).catch === 'function') {
    void (p as Promise<void>).catch(() => {});
  }
};

export const QuickActions: React.FC<QuickActionsProps> = ({
  onAction,
  disabled,
  language = 'en',
  presetsBlocked = false,
}) => {
  const t = {
    en: {
      sunny: "Sunny Day",
      nature: "Add Nature",
      water: "Add Water",
      noCars: "No Cars",
      bench: "Bench",
      bikeRack: "Bike Rack",
      presetsBlockedHint:
        'In Area Edit, brush a region first — or switch to Compare for full-image presets.',
    },
    de: {
      sunny: "Sonnig",
      nature: "Natur pur",
      water: "Mehr Wasser",
      noCars: "Ohne Autos",
      bench: "Sitzbank",
      bikeRack: "Fahrradständer",
      presetsBlockedHint:
        'Im Bereich bearbeiten zuerst markieren — oder zu Vergleichen wechseln für ganze Bild-Vorlagen.',
    },
  }[language];

  const presetDisabled = disabled || presetsBlocked;

  return (
    <div className="space-y-3">
      {presetsBlocked && (
        <p className="text-xs font-bold text-eb-900 leading-snug border border-eb-900/20 bg-coral-100/40 px-2 py-2" role="status">
          {t.presetsBlockedHint}
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
      <ActionBtn
        icon={<Sun className="w-8 h-8 text-amber-400 fill-amber-400/20" />}
        label={t.sunny}
        onClick={() => swallowAsync(onAction(TransformationType.SUNNY_DAY))}
        disabled={presetDisabled}
      />
      <ActionBtn
        icon={<Trees className="w-8 h-8 text-emerald-500 fill-emerald-500/20" />}
        label={t.nature}
        onClick={() => swallowAsync(onAction(TransformationType.ADD_TREES))}
        disabled={presetDisabled}
      />
      <ActionBtn
        icon={<Droplets className="w-8 h-8 text-sky-500 fill-sky-500/20" />}
        label={t.water}
        onClick={() => swallowAsync(onAction(TransformationType.ADD_WATER))}
        disabled={presetDisabled}
      />
      <ActionBtn
        icon={<Ban className="w-8 h-8 text-red-500" />}
        label={t.noCars}
        onClick={() => swallowAsync(onAction(TransformationType.REMOVE_CARS))}
        disabled={presetDisabled}
      />
      <ActionBtn
        icon={<Armchair className="w-8 h-8 text-amber-800 fill-amber-800/15" />}
        label={t.bench}
        onClick={() => swallowAsync(onAction(TransformationType.ADD_BENCH))}
        disabled={presetDisabled}
      />
      <ActionBtn
        icon={<Bike className="w-8 h-8 text-slate-600" />}
        label={t.bikeRack}
        onClick={() => swallowAsync(onAction(TransformationType.ADD_BIKE_RACK))}
        disabled={presetDisabled}
      />
      </div>
    </div>
  );
};

interface ActionBtnProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

const ActionBtn: React.FC<ActionBtnProps> = ({ icon, label, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex flex-col items-center justify-center h-28 bg-white border-2 border-eb-900 transition-all group disabled:opacity-30 disabled:cursor-not-allowed shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
  >
    <div className="mb-2">
      {icon}
    </div>
    <span className="text-xs font-black text-eb-900 tracking-widest text-center">
      {label}
    </span>
  </button>
);