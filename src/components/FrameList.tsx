import { useRef, useState, type ReactNode } from 'react';
import type { Project } from '../model/types';
import { resolveFrame } from '../model/defaults';
import { CloseIcon, ReplaceIcon, TrashIcon } from './icons';

interface Props {
  project: Project;
  selection: string[];
  onSelect: (id: string, mode: 'single' | 'toggle' | 'range') => void;
  onSelectAll: () => void;
  onRemove: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onPickFiles: (files: FileList) => void;
  onReplace: (id: string, file: File) => void;
  onClear: () => void;
  /** Те, що стоїть між заголовком із контролами та самими кадрами (накладка й фон). */
  children?: ReactNode;
}

/** Заголовок Frames, під ним однакові кнопки на всю ширину, далі children (накладка/фон) і сам список кадрів. */
export function FrameList({ project, selection, onSelect, onSelectAll, onRemove, onMove, onPickFiles, onReplace, onClear, children }: Props) {
  const addRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceId = useRef<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const n = project.frames.length;

  return (
    <div className="frames-block">
      <h2>Frames{n > 0 && <span className="count">{n}</span>}</h2>
      <div className="ctl-row">
        <button onClick={() => addRef.current?.click()}>+ Add</button>
        <button disabled={n < 2} onClick={onSelectAll}>Select all</button>
        <button className="icon danger" aria-label="Delete all frames" data-tip="Delete all frames" data-tip-pos="left" disabled={n === 0} onClick={onClear}><TrashIcon /></button>
      </div>
      <input ref={addRef} type="file" accept="image/*,video/*" multiple hidden
        onChange={(e) => { if (e.target.files) onPickFiles(e.target.files); e.target.value = ''; }} />
      <input ref={replaceRef} type="file" accept="image/*,video/*" hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && replaceId.current) onReplace(replaceId.current, file);
          e.target.value = '';
        }} />

      {children}

      {n === 0 ? (
        <p className="hint">Drop screenshots here or click Add</p>
      ) : (
        <ol>
          {project.frames.map((frame, i) => {
            const rf = resolveFrame(project, frame);
            const img = frame.layers.find((l) => !l.fill), fill = frame.layers.find((l) => l.fill);
            const cls = ['frame', selection.includes(frame.id) ? 'selected' : '', dragOver === i && dragFrom !== null && dragFrom !== i ? 'drop-target' : ''].join(' ');
            return (
              <li key={frame.id} className={cls} draggable
                onClick={(e) => onSelect(frame.id, e.shiftKey ? 'range' : e.metaKey || e.ctrlKey ? 'toggle' : 'single')}
                onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
                onDragOver={(e) => { if (dragFrom !== null) { e.preventDefault(); setDragOver(i); } }}
                onDrop={(e) => {
                  if (dragFrom !== null) { // перестановка кадрів
                    e.preventDefault(); e.stopPropagation();
                    onMove(dragFrom, i); setDragFrom(null); setDragOver(null);
                  } else if (e.dataTransfer.files.length > 0) { // файл, кинутий на кадр, замінює його картинку
                    e.preventDefault(); // сторінка бачить defaultPrevented і не додає новий кадр
                    onReplace(frame.id, e.dataTransfer.files[0]);
                  }
                }}
                onDragEnd={() => { setDragFrom(null); setDragOver(null); }}>
                <span className="thumb" style={{ background: fill?.fill }}>{img ? <img src={img.clip?.poster ?? img.src} alt="" draggable={false} /> : <i className="swatch-thumb" />}</span>
                <span className="meta">
                  <b className="fname" title={frame.name}>{frame.name || `Image ${i + 1}`}</b>
                  <span className="dur">{i + 1} · {rf.duration.toFixed(1)} s</span>
                </span>
                <span className="acts">
                  <button className="icon danger" data-tip="Delete frame · Delete" data-tip-pos="left" aria-label={`Delete frame ${i + 1}`}
                    onClick={(e) => { e.stopPropagation(); onRemove(frame.id); }}><CloseIcon /></button>
                  <button className="icon" data-tip="Replace image" data-tip-pos="left" aria-label={`Replace image of frame ${i + 1}`}
                    onClick={(e) => { e.stopPropagation(); replaceId.current = frame.id; replaceRef.current?.click(); }}>
                    <ReplaceIcon />
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
