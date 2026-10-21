import { useState } from 'react';
import type { Project } from '../model/types';
import { CheckRow, NumberField, Row, Seg, SliderRow } from './ui';

type Preset = Project['canvas']['preset'];

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
  // Ширину й висоту редагуємо як текст, поки не набрано коректне число.
  const [draft, setDraft] = useState<string>(background);
  return (
    <>
      <Seg label="Aspect ratio" value={preset} onChange={onPreset} options={[
        { id: '1:1', label: '1:1' }, { id: '4:5', label: '4:5' }, { id: '16:9', label: '16:9' }, { id: '9:16', label: '9:16' }, { id: 'custom', label: 'Custom' },
      ]} />
      <Row label="Size, px">
        <NumberField value={w} min={64} max={4096} width={56} onChange={(v) => onSize(v, h)} />
        <span className="x">×</span>
        <NumberField value={h} min={64} max={4096} width={56} onChange={(v) => onSize(w, v)} />
      </Row>
      <Row label="Background">
        <input type="color" value={background} onChange={(e) => { setDraft(e.target.value); onBackground(e.target.value); }} aria-label="Background color" />
        <input className="hex" value={draft.toUpperCase()} maxLength={7} aria-label="Background color, hex"
          onChange={(e) => { setDraft(e.target.value); if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onBackground(e.target.value.toLowerCase()); }}
          onBlur={() => setDraft(background)} />
      </Row>
      <CheckRow label="Safe zone" checked={showSafe} onChange={onShowSafe} />
      {showSafe && <SliderRow label="Inset, %" value={inset} min={0} max={0.2} step={0.01} scale={100} onChange={onSafeInset} />}
    </>
  );
}
