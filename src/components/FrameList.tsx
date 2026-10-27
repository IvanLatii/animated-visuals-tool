import { useRef, useState } from 'react';
import type { Project } from '../model/types';
import { resolveFrame } from '../model/defaults';
import { TrashIcon } from './icons';

interface Props {
  project: Project;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onPickFiles: (files: FileList) => void;
  onReplace: (id: string, file: File) => void;
  onClear: () => void;
}

export function FrameList({ project, selectedId, onSelect, onRemove, onMove, onPickFiles, onReplace, onClear }: Props) {
  const addRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceId = useRef<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  return (
    <section className="panel frames">
      <header>
        <h2>Frames</h2>
        <div className="head-actions">
          <button className="icon danger" aria-label="Delete all frames" data-tip="Delete all frames" data-tip-pos="left"
            disabled={project.frames.length === 0} onClick={onClear}>
            <TrashIcon />
          </button>
          <button onClick={() => addRef.current?.click()}>+ Add</button>
        </div>
        <input ref={addRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => { if (e.target.files) onPickFiles(e.target.files); e.target.value = ''; }} />
        <input ref={replaceRef} type="file" accept="image/*" hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && replaceId.current) onReplace(replaceId.current, file);
            e.target.value = '';
          }} />
      </header>

      {project.frames.length === 0 ? (
        <p className="hint">Drop screenshots here or click Add</p>
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
                  if (dragFrom !== null) { // перестановка кадрів
                    e.preventDefault(); e.stopPropagation();
                    onMove(dragFrom, i); setDragFrom(null); setDragOver(null);
                  } else if (e.dataTransfer.files.length > 0) { // файл, кинутий на кадр, замінює його картинку
                    e.preventDefault(); // сторінка бачить defaultPrevented і не додає новий кадр
                    onReplace(frame.id, e.dataTransfer.files[0]);
                  }
                }}
                onDragEnd={() => { setDragFrom(null); setDragOver(null); }}>
                <span className="num">{i + 1}</span>
                <span className="thumb">
                  <img src={frame.layers[0].src} alt="" draggable={false} />
                  <button className="rep" aria-label={`Replace image of frame ${i + 1}`}
                    onClick={(e) => { e.stopPropagation(); replaceId.current = frame.id; replaceRef.current?.click(); }}>Replace</button>
                </span>
                <span className="dur">{rf.duration.toFixed(1)} s</span>
                <button className="icon danger" data-tip="Delete frame · Delete" data-tip-pos="left" aria-label={`Delete frame ${i + 1}`}
                  onClick={(e) => { e.stopPropagation(); onRemove(frame.id); }}>×</button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
