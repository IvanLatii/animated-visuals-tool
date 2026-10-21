import { useRef, useState } from 'react';
import type { Project } from '../model/types';
import { resolveFrame } from '../model/defaults';

interface Props {
  project: Project;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onPickFiles: (files: FileList) => void;
}

export function FrameList({ project, selectedId, onSelect, onRemove, onMove, onPickFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  return (
    <section className="panel frames">
      <header>
        <h2>Кадри</h2>
        <button onClick={() => inputRef.current?.click()}>Додати картинки</button>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => { if (e.target.files) onPickFiles(e.target.files); e.target.value = ''; }} />
      </header>

      {project.frames.length === 0 ? (
        <p className="hint">Перетягни сюди скриншоти або натисни «Додати картинки».</p>
      ) : (
        <ol>
          {project.frames.map((frame, i) => {
            const rf = resolveFrame(project, frame);
            const cls = ['frame', frame.id === selectedId ? 'selected' : '', dragOver === i && dragFrom !== null && dragFrom !== i ? 'drop-target' : ''].join(' ');
            return (
              <li key={frame.id} className={cls} draggable
                onClick={() => onSelect(frame.id)}
                onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
                onDragOver={(e) => { if (dragFrom !== null) { e.preventDefault(); setDragOver(i); } }}
                onDrop={(e) => {
                  if (dragFrom === null) return; // файли з Finder обробляє сторінка
                  e.preventDefault(); e.stopPropagation();
                  onMove(dragFrom, i); setDragFrom(null); setDragOver(null);
                }}
                onDragEnd={() => { setDragFrom(null); setDragOver(null); }}>
                <span className="num">{i + 1}</span>
                <img src={frame.layers[0].src} alt="" draggable={false} />
                <span className="dur">{rf.duration.toFixed(1)} с</span>
                <button className="icon" title="Видалити кадр" aria-label={`Видалити кадр ${i + 1}`}
                  onClick={(e) => { e.stopPropagation(); onRemove(frame.id); }}>×</button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
