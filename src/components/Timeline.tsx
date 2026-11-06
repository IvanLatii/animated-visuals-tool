import { useRef } from 'react';
import type { AudioTrack, Project } from '../model/types';
import { buildTimeline } from '../render/renderScene';
import { Waveform } from './Waveform';

interface Props {
  project: Project;
  t: number;
  selection: string[];
  onSeek: (t: number) => void;
  onSelect: (id: string) => void;
  /** trim = true, коли тримають ⌘/Ctrl: кліп обрізається замість зміни швидкості. */
  onDuration: (id: string, d: number, trim: boolean) => void;
  audioSel: string | null;
  onSelectAudio: (id: string) => void;
  onAudio: (id: string, patch: Partial<AudioTrack>) => void;
}

type LaneDrag = { id: string; kind: 'move' | 'in' | 'out'; x0: number; a: AudioTrack; pxPerSec: number };

export function Timeline({ project, t, selection, onSeek, onSelect, onDuration, audioSel, onSelectAudio, onAudio }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const edge = useRef<{ id: string; startX: number; startDur: number; pxPerSec: number } | null>(null);
  const lane = useRef<LaneDrag | null>(null);
  const { items, total } = buildTimeline(project);
  const tracks = project.audio ?? [];

  const seekFromPointer = (clientX: number) => {
    const bar = wrapRef.current;
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
    const width = wrapRef.current?.getBoundingClientRect().width ?? 1;
    edge.current = { id, startX: e.clientX, startDur: dur, pxPerSec: width / Math.max(total, 0.1) };
    onSelect(id);
  };
  const edgeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = edge.current;
    if (!d) return;
    onDuration(d.id, Math.min(30, Math.max(0.1, Math.round((d.startDur + (e.clientX - d.startX) / d.pxPerSec) * 20) / 20)), e.metaKey || e.ctrlKey);
  };

  // Смуга звуку: тягнеш посередині — зсув, за краї — обрізка (початок обрізки зсуває in і start разом, тож звук не їде).
  const laneDown = (e: React.PointerEvent<HTMLElement>, a: AudioTrack, kind: LaneDrag['kind']) => {
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* штучна подія без реального вказівника */ }
    const width = wrapRef.current?.getBoundingClientRect().width ?? 1;
    lane.current = { id: a.id, kind, x0: e.clientX, a, pxPerSec: width / Math.max(total, 0.1) };
    onSelectAudio(a.id);
  };
  const laneMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = lane.current;
    if (!d) return;
    const dt = (e.clientX - d.x0) / d.pxPerSec;
    if (d.kind === 'move') onAudio(d.id, { start: Math.max(0, d.a.start + dt) });
    else if (d.kind === 'in') {
      const din = Math.min(Math.max(-d.a.in, dt * d.a.speed), d.a.out - d.a.in - 0.05);
      onAudio(d.id, { in: d.a.in + din, start: Math.max(0, d.a.start + din / d.a.speed) });
    } else onAudio(d.id, { out: d.a.out + dt * d.a.speed });
  };
  const laneUp = () => { lane.current = null; };

  return (
    <section className="timeline">
      {total === 0 ? <p className="hint">No frames yet</p> : (
        <div ref={wrapRef} className="tl-wrap"
          onPointerDown={(e) => { dragging.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* штучна подія без реального вказівника */ } seekFromPointer(e.clientX); }}
          onPointerMove={(e) => { if (dragging.current) seekFromPointer(e.clientX); }}
          onPointerUp={() => { dragging.current = false; }}>
          <div className="bar">
            {items.map((it) => (
              <div key={it.rf.frame.id} className={`seg-t ${selection.includes(it.rf.frame.id) ? 'selected' : ''}`}
                style={(() => {
                  const ls = it.rf.frame.layers, img = ls.find((l) => !l.fill), fill = ls.find((l) => l.fill);
                  return { flexGrow: it.rf.duration, backgroundImage: img ? `url(${img.clip?.poster ?? img.src})` : undefined, backgroundColor: fill?.fill };
                })()}>
                <span>{it.rf.duration.toFixed(2)} s</span>
                <div className="edge" onPointerDown={(e) => edgeDown(e, it.rf.frame.id, it.rf.duration)} onPointerMove={edgeMove} onPointerUp={() => { edge.current = null; }} onPointerCancel={() => { edge.current = null; }} />
              </div>
            ))}
          </div>
          {tracks.map((a) => {
            const len = (a.out - a.in) / a.speed;
            const end = a.loop ? Math.max(total, a.start + len) : a.start + len;
            const dim = a.muted || (tracks.some((x) => x.solo) && !a.solo);
            return (
              <div key={a.id} className="lane-row">
                <div className={`lane ${audioSel === a.id ? 'selected' : ''} ${dim ? 'dim' : ''}`}
                  style={{ left: `${(a.start / total) * 100}%`, width: `${((end - a.start) / total) * 100}%` }}
                  onPointerDown={(e) => laneDown(e, a, 'move')} onPointerMove={laneMove} onPointerUp={laneUp} onPointerCancel={laneUp}>
                  <Waveform track={a} laneSec={end - a.start} />
                  <span className="lane-name">{a.name}</span>
                  <i className="lane-h l" onPointerDown={(e) => laneDown(e, a, 'in')} />
                  <i className="lane-h r" onPointerDown={(e) => laneDown(e, a, 'out')} />
                </div>
              </div>
            );
          })}
          <div className="playhead" style={{ left: `${(Math.min(t, total) / total) * 100}%` }} />
        </div>
      )}
    </section>
  );
}
