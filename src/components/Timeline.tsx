import { useRef } from 'react';
import type { Project } from '../model/types';
import { buildTimeline } from '../render/renderScene';

interface Props {
  project: Project;
  t: number;
  selectedId: string | null;
  onSeek: (t: number) => void;
  onSelect: (id: string) => void;
}

export function Timeline({ project, t, selectedId, onSeek, onSelect }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
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

  return (
    <section className="timeline">
      {total === 0 ? <p className="hint">Таймлайн з'явиться, коли додаси кадри.</p> : (
        <div ref={barRef} className="bar"
          onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); seekFromPointer(e.clientX); }}
          onPointerMove={(e) => { if (dragging.current) seekFromPointer(e.clientX); }}
          onPointerUp={() => { dragging.current = false; }}>
          {items.map((it) => (
            <div key={it.rf.frame.id} className={`seg-t ${it.rf.frame.id === selectedId ? 'selected' : ''}`}
              style={{ flexGrow: it.rf.duration, backgroundImage: `url(${it.rf.frame.layers[0].src})` }}>
              <span>{it.rf.duration.toFixed(1)} с</span>
            </div>
          ))}
          <div className="playhead" style={{ left: `${(Math.min(t, total) / total) * 100}%` }} />
        </div>
      )}
    </section>
  );
}
