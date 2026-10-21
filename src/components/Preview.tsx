import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { Project } from '../model/types';
import { renderScene, type Assets } from '../render/renderScene';

interface Props {
  project: Project;
  assets: Assets;
  t: number;
  showSafe: boolean;
  playing: boolean;
  loop: boolean;
  duration: number;
  onTogglePlay: () => void;
  onToggleLoop: (v: boolean) => void;
}

const PAD_X = 56, PAD_Y = 52; // місце для кутових рисок і підписів навколо артборда
const MIN_SCALE = 0.05, MAX_SCALE = 8;

interface View { zoom: number; x: number; y: number } // zoom = множник відносно «вмістити», x/y — зсув у пікселях екрана

export function Preview({ project, assets, t, showSafe, playing, loop, duration, onTogglePlay, onToggleLoop }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const { w, h } = project.canvas;
  const safe = project.canvas.safeZone ?? { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 };

  // Масштаб, при якому артборд повністю вміщується (пікселів екрана на піксель полотна).
  const fit = box.w > 0 ? Math.max(0.01, Math.min((box.w - 2 * PAD_X) / w, (box.h - 2 * PAD_Y) / h)) : 1;
  const scale = fit * view.zoom;
  const zMin = Math.min(1, MIN_SCALE / fit), zMax = Math.max(1, MAX_SCALE / fit);

  useEffect(() => {
    if (canvasRef.current) renderScene(project, t, canvasRef.current, assets);
  }, [project, assets, t]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure(); // одразу, не чекаючи спостерігача
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Масштабування навколо точки (cx, cy) — вона рахується від центру сцени й лишається на місці. */
  const zoomBy = useCallback((factor: number, cx = 0, cy = 0) => {
    setView((v) => {
      const zoom = Math.min(zMax, Math.max(zMin, v.zoom * factor));
      const k = zoom / v.zoom;
      return { zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  }, [zMin, zMax]);
  const zoomTo = useCallback((zoom: number) => zoomBy(zoom / view.zoom), [zoomBy, view.zoom]);
  const fitView = useCallback(() => setView({ zoom: 1, x: 0, y: 0 }), []);

  // Колесо: ⌘/Ctrl або щипок на трекпаді — масштаб, просто прокрутка двома пальцями — панорама.
  // Слухач нативний і не «пасивний», інакше сторінка сама масштабувалась би.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const speed = e.ctrlKey && !e.metaKey ? 0.01 : 0.0015; // щипок дає малі кроки, ⌘+колесо — великі
        zoomBy(Math.min(1.25, Math.max(0.8, Math.exp(-e.deltaY * speed))), e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  // ⌘ + / ⌘ − / ⌘ 0 / ⌘ 1
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomBy(1.25); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(0.8); }
      else if (e.key === '0') { e.preventDefault(); fitView(); }
      else if (e.key === '1') { e.preventDefault(); zoomTo(1 / fit); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomBy, zoomTo, fitView, fit]);

  // Середня кнопка миші (колесо натиснути й тягнути) — перетягування артборда.
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 1) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* штучна подія без реального вказівника */ }
    panRef.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
    setPanning(true);
  };
  const onPointerMove = (e: PointerEvent) => {
    const p = panRef.current;
    if (p) setView((v) => ({ ...v, x: p.vx + e.clientX - p.sx, y: p.vy + e.clientY - p.sy }));
  };
  const endPan = () => { panRef.current = null; setPanning(false); };

  const empty = project.frames.length === 0;
  const presetLabel = project.canvas.preset === 'custom' ? 'Custom' : project.canvas.preset;
  const pct = Math.round(scale * 100);
  return (
    <section className="preview">
      <div ref={stageRef} className={`stage ${panning ? 'panning' : ''}`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endPan} onPointerCancel={endPan}
        onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); }} onDoubleClick={fitView}>
        <div className="canvas-wrap" style={{ width: w * scale, height: h * scale, transform: `translate(${view.x}px, ${view.y}px)`, visibility: box.w ? 'visible' : 'hidden' } as CSSProperties}>
          <div className="marks" aria-hidden><i /><i /><i /><i /></div>
          <span className="cap top">Scene · {duration.toFixed(1)} s</span>
          <canvas ref={canvasRef} width={w} height={h} />
          {showSafe && (
            <div className="safe-zone" style={{ inset: `${safe.top * 100}% ${safe.right * 100}% ${safe.bottom * 100}% ${safe.left * 100}%` }}>
              <span>Safe zone</span>
            </div>
          )}
          <span className="cap bottom">{presetLabel} · {w}×{h} · {pct}%</span>
        </div>
        {empty && <div className="empty">Add images to see the preview</div>}
        <div className="zoombar" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          <button onClick={() => zoomBy(0.8)} aria-label="Zoom out" data-tip="Zoom out · ⌘ −">−</button>
          <button className="pct" data-tip="Actual size · ⌘ 1" onClick={() => zoomTo(1 / fit)}>{pct}%</button>
          <button onClick={() => zoomBy(1.25)} aria-label="Zoom in" data-tip="Zoom in · ⌘ +">+</button>
          <button data-tip="Fit to screen · ⌘ 0" onClick={fitView}>Fit</button>
        </div>
      </div>
      <div className="transport">
        <button className="primary play" data-tip="Play / pause · Space" data-tip-pos="top" onClick={onTogglePlay} disabled={empty}>{playing ? '❚❚  Pause' : '▶  Play'}</button>
        <label className="chk"><input type="checkbox" checked={loop} onChange={(e) => onToggleLoop(e.target.checked)} /> Loop</label>
        <span className="time">{Math.min(t, duration).toFixed(2)} / {duration.toFixed(2)} s</span>
      </div>
    </section>
  );
}
