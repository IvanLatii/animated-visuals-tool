import { useState } from 'react';
import type { Project } from '../model/types';

type Preset = Project['canvas']['preset'];
const PRESETS: { id: Preset; label: string }[] = [
  { id: '1:1', label: '1:1' }, { id: '4:5', label: '4:5' }, { id: '16:9', label: '16:9' }, { id: '9:16', label: '9:16' }, { id: 'custom', label: 'Свій' },
];

interface Props {
  project: Project;
  showSafe: boolean;
  onShowSafe: (v: boolean) => void;
  onPreset: (p: Preset) => void;
  onSize: (w: number, h: number) => void;
  onBackground: (c: string) => void;
  onSafeInset: (v: number) => void;
}

export function CanvasControls({ project, showSafe, onShowSafe, onPreset, onSize, onBackground, onSafeInset }: Props) {
  const { w, h, preset, background, safeZone } = project.canvas;
  const inset = safeZone?.top ?? 0.05;
  // Поки Іван друкує, число може бути неповним, тому тримаємо текст окремо й віддаємо проєкту лише коректне.
  const [draft, setDraft] = useState<{ w?: string; h?: string }>({});
  const commit = (axis: 'w' | 'h', text: string) => {
    setDraft((d) => ({ ...d, [axis]: text }));
    const v = Number(text);
    if (Number.isFinite(v) && v >= 64 && v <= 4096) onSize(axis === 'w' ? v : w, axis === 'h' ? v : h);
  };

  return (
    <div className="group">
      <div className="subhead"><h3>Полотно</h3></div>
      <div className="seg-buttons" role="group" aria-label="Співвідношення сторін">
        {PRESETS.map((p) => (
          <button key={p.id} className={preset === p.id ? 'on' : ''} onClick={() => { setDraft({}); onPreset(p.id); }}>{p.label}</button>
        ))}
      </div>
      <div className="size-row">
        <input type="number" aria-label="Ширина, px" value={draft.w ?? w} onChange={(e) => commit('w', e.target.value)} onBlur={() => setDraft({})} />
        <span>×</span>
        <input type="number" aria-label="Висота, px" value={draft.h ?? h} onChange={(e) => commit('h', e.target.value)} onBlur={() => setDraft({})} />
        <span className="unit">px</span>
      </div>
      <label className="field inline"><span>Колір тла</span>
        <input type="color" value={background} onChange={(e) => onBackground(e.target.value)} />
      </label>
      <label className="field inline"><span>Показати safe-зону</span>
        <input type="checkbox" checked={showSafe} onChange={(e) => onShowSafe(e.target.checked)} />
      </label>
      {showSafe && (
        <label className="field"><span>Відступ safe-зони: {Math.round(inset * 100)}%</span>
          <input type="range" min={0} max={0.2} step={0.01} value={inset} onChange={(e) => onSafeInset(Number(e.target.value))} />
        </label>
      )}
    </div>
  );
}
