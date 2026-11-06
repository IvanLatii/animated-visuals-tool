import { useRef } from 'react';
import type { Project } from '../model/types';
import { buildTimeline } from '../render/renderScene';

interface Props {
  project: Project;
  t: number;
  selection: string[];
  onSeek: (t: number) => void;
  onSelect: (id: string) => void;
  onDuration: (id: string, d: number) => void;
}

export function Timeline({ project, t, selection, onSeek, onSelect, onDuration }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const edge = useRef<{ id: string; startX: number; startDur: number; pxPerSec: number } | null>(null);
  const { items, total } = buildTimeline(project);

  const seekFromPointer = (clientX: number) => {
    const bar = barRef.current;
    if (!bar || total <= 0) return;
    const rect = bar.getBoundingClientRect();
    const time = Math.min(total, Math.max(0, ((clientX - rect.left) / rect.width) * total));
    onSeek(time);
    const hit = items.find((it) => time >= it.start && time < it.end) ?? items[items.length - 1];
    if (hit) onSelect(hit.rf.frame.id);
  };

  // Край кадра: тягнеш вправо — кадр довший, вліво — коротший (крок 0.05 с). Масштаб беремо на початку, інакше зсувався б під курсором.
  const edgeDown = (e: React.PointerEvent<HTMLDivElement>, id: string, dur: number) => {
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* штучна подія без реального вказівника */ }
    const width = barRef.current?.getBoundingClientRect().width ?? 1;
    edge.current = { id, startX: e.clientX, startDur: dur, pxPerSec: width / Math.max(total, 0.1) };
    onSelect(id);
  };
  const edgeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = edge.current;
    if (!d) return;
    onDuration(d.id, Math.min(30, Math.max(0.1, Math.round((d.startDur + (e.clientX - d.startX) / d.pxPerSec) * 20) / 20)));
  };

  return (
    <section className="timeline">
      {total === 0 ? <p className="hint">No frames yet</p> : (
        <div ref={barRef} className="bar"
          onPointerDown={(e) => { dragging.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* штучна подія без реального вказівника */ } seekFromPointer(e.clientX); }}
          onPointerMove={(e) => { if (dragging.current) seekFromPointer(e.clientX); }}
          onPointerUp={() => { dragging.current = false; }}>
          {items.map((it) => (
            <div key={it.rf.frame.id} className={`seg-t ${selection.includes(it.rf.frame.id) ? 'selected' : ''}`}
              style={{ flexGrow: it.rf.duration, backgroundImage: `url(${it.rf.frame.layers[0].clip?.poster ?? it.rf.frame.layers[0].src})` }}>
              <span>{it.rf.duration.toFixed(2)} s</span>
              <div className="edge" onPointerDown={(e) => edgeDown(e, it.rf.frame.id, it.rf.duration)} onPointerMove={edgeMove} onPointerUp={() => { edge.current = null; }} onPointerCancel={() => { edge.current = null; }} />
            </div>
          ))}
          <div className="playhead" style={{ left: `${(Math.min(t, total) / total) * 100}%` }} />
        </div>
      )}
    </section>
  );
}
