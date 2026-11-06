import { useRef, useState } from 'react';
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
  onReplace: (frameId: string, index: number, file: File) => void;
  /** Перестановка шарів: from і to — індекси в масиві шарів (0 — нижній). */
  onMove: (frameId: string, from: number, to: number) => void;
}

/** Шари вибраного кадру: знизу основне зображення, поверх можна додати картинку, GIF чи відео. Рядки й кнопки такі самі, як у списку кадрів ліворуч. */
export function FrameLayers({ project, selection, li, onSelect, onAdd, onRemove, onReplace, onMove }: Props) {
  const addRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceIndex = useRef(0);
  const [dragFrom, setDragFrom] = useState<number | null>(null); // індекс шару, який тягнуть
  const [dragOver, setDragOver] = useState<number | null>(null);
  const frame = project.frames.find((f) => f.id === selection[selection.length - 1]);
  if (!frame) return null;
  const n = frame.layers.length;
  const active = Math.min(li, n - 1);
  const rows = frame.layers.map((l, i) => ({ l, i })).reverse(); // верхній шар першим, як у редакторах

  return (
    <Section id="frame-layers" title="Layers in frame"
      aside={<button className="link" style={{ position: 'absolute', right: 44, top: '50%', transform: 'translateY(-50%)' }} onClick={() => addRef.current?.click()}>+ Add layer</button>}>
      <input ref={addRef} type="file" accept="image/*,video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onAdd(frame.id, f); e.target.value = ''; }} />
      <input ref={replaceRef} type="file" accept="image/*,video/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onReplace(frame.id, replaceIndex.current, f); e.target.value = ''; }} />
      <div className="frames-block">
        <ol>
          {rows.map(({ l, i }) => {
            const kind = l.clip ? (l.clip.kind === 'gif' ? 'GIF' : 'Video') : 'Image';
            const cls = ['frame', i === active ? 'selected' : '', dragOver === i && dragFrom !== null && dragFrom !== i ? 'drop-target' : ''].join(' ');
            return (
              <li key={i} className={cls} draggable
                onClick={() => onSelect(i)}
                onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', `layer:${i}`); }}
                onDragOver={(e) => { if (dragFrom !== null) { e.preventDefault(); setDragOver(i); } }}
                onDrop={(e) => {
                  if (dragFrom !== null) { // перестановка шарів
                    e.preventDefault(); e.stopPropagation();
                    if (dragFrom !== i) onMove(frame.id, dragFrom, i);
                    setDragFrom(null); setDragOver(null);
                  } else if (e.dataTransfer.files.length > 0) { // файл, кинутий на шар, замінює його
                    e.preventDefault(); e.stopPropagation();
                    onReplace(frame.id, i, e.dataTransfer.files[0]);
                  }
                }}
                onDragEnd={() => { setDragFrom(null); setDragOver(null); }}>
                <span className="num">{i + 1}</span>
                <span className="thumb"><img src={l.clip?.poster ?? l.src} alt="" draggable={false} /></span>
                <span className="meta">
                  <b className="fname" title={l.name}>{l.name ?? (i === 0 ? frame.name ?? 'Image' : `Layer ${i + 1}`)}</b>
                  <span className="dur">{kind}{i === 0 ? ' · base' : ''}</span>
                </span>
                <span className="acts">
                  {n > 1
                    ? <button className="icon danger" data-tip="Remove layer" data-tip-pos="left" aria-label={`Remove layer ${i + 1}`} onClick={(e) => { e.stopPropagation(); onRemove(frame.id, i); }}>×</button>
                    : <span />}
                  <button className="icon" data-tip="Replace image" data-tip-pos="left" aria-label={`Replace layer ${i + 1}`}
                    onClick={(e) => { e.stopPropagation(); replaceIndex.current = i; replaceRef.current?.click(); }}>
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden><path d="M2.5 5h9M9 2.5 11.5 5 9 7.5M13.5 11h-9M7 8.5 4.5 11 7 13.5" /></svg>
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </Section>
  );
}
