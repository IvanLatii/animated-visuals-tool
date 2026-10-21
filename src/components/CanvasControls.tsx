import { useState } from 'react';
import type { Project } from '../model/types';
import { NumberField, Row, Seg } from './ui';

type Preset = Project['canvas']['preset'];

interface Props {
  project: Project;
  onPreset: (p: Preset) => void;
  onSize: (w: number, h: number) => void;
  onBackground: (c: string) => void;
}

export function CanvasControls({ project, onPreset, onSize, onBackground }: Props) {
  const { w, h, preset, background } = project.canvas;
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
    </>
  );
}
