import { useRef, useState } from 'react';
import type { Project } from '../model/types';
import { CloseIcon, DropIcon, PipetteIcon, ReplaceIcon } from './icons';
import { ColorField } from './ColorField';
import { canEyedrop, eyedrop } from '../eyedropper';
import { Section } from './ui';

const SWATCHES = ['#ffffff', '#f3f3f5', '#8b8b94', '#17171a', '#000000', '#3643ff', '#ff2d8a', '#ffd400', '#22c55e'];

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
  /** Швидка заливка кольором: новий шар під усіма. */
  onAddFill: (frameId: string, color: string) => void;
}

/** Шари вибраного кадру: знизу основне зображення, поверх можна додати картинку, GIF чи відео. Рядки й кнопки такі самі, як у списку кадрів ліворуч. */
export function FrameLayers({ project, selection, li, onSelect, onAdd, onRemove, onReplace, onMove, onAddFill }: Props) {
  const [fillOpen, setFillOpen] = useState(false);
  const [fillColor, setFillColor] = useState('#ffffff');
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
      aside={(
        <span className="sec-aside">
          <button className="icon" aria-pressed={fillOpen} data-tip="Fill with color" data-tip-pos="top" aria-label="Add color fill" onClick={() => setFillOpen(!fillOpen)}><DropIcon /></button>
          <button className="link" onClick={() => addRef.current?.click()}>+ Add layer</button>
        </span>
      )}>
      {fillOpen && (
        <div className="fillpop">
          <div className="swatches">
            {[...new Set([project.canvas.background, ...SWATCHES])].map((c) => (
              <button key={c} className="sw" style={{ background: c }} aria-label={`Fill with ${c}`} data-tip={c} data-tip-pos="top"
                onClick={() => { onAddFill(frame.id, c); setFillOpen(false); }} />
            ))}
            {canEyedrop && (
              <button className="sw pip" aria-label="Pick color from screen" data-tip="Pick from screen · I" data-tip-pos="top"
                onClick={async () => { const c = await eyedrop(); if (c) { onAddFill(frame.id, c); setFillOpen(false); } }}><PipetteIcon /></button>
            )}
          </div>
          <div className="r"><ColorField value={fillColor} onChange={setFillColor} /><button onClick={() => { onAddFill(frame.id, fillColor); setFillOpen(false); }}>Fill</button></div>
        </div>
      )}
      <input ref={addRef} type="file" accept="image/*,video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onAdd(frame.id, f); e.target.value = ''; }} />
      <input ref={replaceRef} type="file" accept="image/*,video/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onReplace(frame.id, replaceIndex.current, f); e.target.value = ''; }} />
      <div className="frames-block">
        <ol>
          {rows.map(({ l, i }) => {
            const kind = l.fill ? 'Fill' : l.clip ? (l.clip.kind === 'gif' ? 'GIF' : 'Video') : 'Image';
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
                <span className="thumb">{l.fill ? <i className="swatch-thumb" style={{ background: l.fill }} /> : <img src={l.clip?.poster ?? l.src} alt="" draggable={false} />}</span>
                <span className="meta">
                  <b className="fname" title={l.name}>{l.name ?? (i === 0 ? frame.name ?? 'Image' : `Layer ${i + 1}`)}</b>
                  <span className="dur">{i + 1} · {kind}</span>
                </span>
                <span className="acts">
                  {n > 1
                    ? <button className="icon danger" data-tip="Remove layer" data-tip-pos="left" aria-label={`Remove layer ${i + 1}`} onClick={(e) => { e.stopPropagation(); onRemove(frame.id, i); }}><CloseIcon /></button>
                    : <span className="acts-gap" />}
                  {!l.fill && <button className="icon" data-tip="Replace image" data-tip-pos="left" aria-label={`Replace layer ${i + 1}`}
                    onClick={(e) => { e.stopPropagation(); replaceIndex.current = i; replaceRef.current?.click(); }}>
                    <ReplaceIcon />
                  </button>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </Section>
  );
}
