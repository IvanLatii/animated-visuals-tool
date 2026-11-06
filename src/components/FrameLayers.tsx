import { useRef } from 'react';
import type { Project } from '../model/types';
import { Section } from './ui';

interface Props {
  project: Project;
  selection: string[];
  /** Вибраний шар кадру (0 — нижній). */
  li: number;
  onSelect: (index: number) => void;
  onAdd: (frameId: string, file: File) => void;
  onRemove: (frameId: string, index: number) => void;
}

/** Шари вибраного кадру: знизу основне зображення, поверх можна додати картинку, GIF чи відео зі своїм розміром, зсувом і поворотом. */
export function FrameLayers({ project, selection, li, onSelect, onAdd, onRemove }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const frame = project.frames.find((f) => f.id === selection[selection.length - 1]);
  if (!frame) return null;
  const active = Math.min(li, frame.layers.length - 1);
  const rows = frame.layers.map((l, i) => ({ l, i })).reverse(); // верхній шар першим, як у редакторах

  return (
    <Section id="frame-layers" title="Layers in frame"
      aside={<button className="link" style={{ position: 'absolute', right: 44, top: '50%', transform: 'translateY(-50%)' }} onClick={() => ref.current?.click()}>+ Add layer</button>}>
      <input ref={ref} type="file" accept="image/*,video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onAdd(frame.id, f); e.target.value = ''; }} />
      <div className="layer-list">
        {rows.map(({ l, i }) => (
          <div key={i} className={`layer-row ${i === active ? 'on' : ''}`} onClick={() => onSelect(i)}>
            <span className="thumb"><img src={l.clip?.poster ?? l.src} alt="" draggable={false} /></span>
            <span className="layer-name">{l.name ?? (i === 0 ? frame.name ?? 'Image' : `Layer ${i + 1}`)}<small>{l.clip ? (l.clip.kind === 'gif' ? 'GIF' : 'Video') : 'Image'}{i === 0 ? ' · base' : ''}</small></span>
            {frame.layers.length > 1 && (
              <button className="icon x" aria-label="Remove layer" data-tip="Remove layer" onClick={(e) => { e.stopPropagation(); onRemove(frame.id, i); }}>×</button>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
