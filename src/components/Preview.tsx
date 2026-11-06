import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { Project, Rect } from '../model/types';
import { onClipFrame } from '../media/clipAsset';
import { renderScene, type Assets } from '../render/renderScene';
import { ImageEditor } from './ImageEditor';

interface Props {
  project: Project;
  assets: Assets;
  t: number;
  editSlot: boolean;
  onSlot: (r: Rect) => void;
  selection: string[];
  keep: boolean;
  activeLayer: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPatches: React.ComponentProps<typeof ImageEditor>['onPatches'];
  playing: boolean;
  loop: boolean;
  duration: number;
  onTogglePlay: () => void;
  onToggleLoop: (v: boolean) => void;
}

const PAD_X = 56, PAD_Y = 52; // місце для кутових рисок і підписів навколо артборда
const MIN_SCALE = 0.05, MAX_SCALE = 8;

type Handle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

interface View { zoom: number; x: number; y: number } // zoom = множник відносно «вмістити», x/y — зсув у пікселях екрана

export function Preview({ project, assets, t, editSlot, onSlot, selection, keep, activeLayer, onPatches, canUndo, canRedo, onUndo, onRedo, playing, loop, duration, onTogglePlay, onToggleLoop }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const slotDrag = useRef<{ handle: Handle; sx: number; sy: number; rect: Rect } | null>(null);
  const { w, h } = project.canvas;
  const visibleZones = project.canvas.safeZones.filter((z) => z.visible);
  // Спільна область: найсуворіший відступ кожного боку з показаних зон.
  const combined = visibleZones.length > 1 ? {
    top: Math.max(...visibleZones.map((z) => z.top)), right: Math.max(...visibleZones.map((z) => z.right)),
    bottom: Math.max(...visibleZones.map((z) => z.bottom)), left: Math.max(...visibleZones.map((z) => z.left)),
  } : null;

  // Масштаб, при якому артборд повністю вміщується (пікселів екрана на піксель полотна).
  const fit = box.w > 0 ? Math.max(0.01, Math.min((box.w - 2 * PAD_X) / w, (box.h - 2 * PAD_Y) / h)) : 1;
  const scale = fit * view.zoom;
  const zMin = Math.min(1, MIN_SCALE / fit), zMax = Math.max(1, MAX_SCALE / fit);

  const imageEditing = !playing && !editSlot && selection.length > 0;
  const [frameTick, setFrameTick] = useState(0);
  useEffect(() => onClipFrame(() => setFrameTick((n) => n + 1)), []); // новий кадр відео/GIF → перемалювати
  useEffect(() => {
    if (canvasRef.current) renderScene(project, t, canvasRef.current, assets);
  }, [project, assets, t, frameTick]);

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

  // Рамка вікна вмісту: тягнеш усередині — рухається, за маркери — змінює розмір. Зсув у пікселях екрана → частки полотна.
  const slotDown = (e: PointerEvent, handle: Handle) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* штучна подія без реального вказівника */ }
    slotDrag.current = { handle, sx: e.clientX, sy: e.clientY, rect: { ...project.stage.slot } };
  };
  const slotMove = (e: PointerEvent) => {
    const d = slotDrag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / (w * scale), dy = (e.clientY - d.sy) / (h * scale);
    const r = { ...d.rect };
    if (d.handle === 'move') { r.x += dx; r.y += dy; }
    else {
      if (d.handle.includes('w')) { r.x = d.rect.x + dx; r.w = d.rect.w - dx; }
      if (d.handle.includes('e')) r.w = d.rect.w + dx;
      if (d.handle.includes('n')) { r.y = d.rect.y + dy; r.h = d.rect.h - dy; }
      if (d.handle.includes('s')) r.h = d.rect.h + dy;
    }
    onSlot(r);
  };

  const empty = project.frames.length === 0;
  const presetLabel = project.canvas.preset === 'custom' ? 'Custom' : project.canvas.preset;
  const pct = Math.round(scale * 100);
  return (
    <section className="preview">
      <div ref={stageRef} className={`stage ${panning ? 'panning' : ''}`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endPan} onPointerCancel={endPan}
        onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); }} onDoubleClick={fitView}>
        <div ref={wrapRef} className="canvas-wrap" style={{ width: w * scale, height: h * scale, transform: `translate(${view.x}px, ${view.y}px)`, visibility: box.w ? 'visible' : 'hidden' } as CSSProperties}>
          <div className="marks" aria-hidden><i /><i /><i /><i /></div>
          <span className="cap top">Scene · {duration.toFixed(1)} s</span>
          <canvas ref={canvasRef} width={w} height={h} />
          {visibleZones.map((z) => (
            <div key={z.id} className="safe-zone" style={{ inset: `${z.top * 100}% ${z.right * 100}% ${z.bottom * 100}% ${z.left * 100}%`, '--zc': z.color } as CSSProperties}>
              <span>{z.name}</span>
            </div>
          ))}
          {combined && (
            <div className="safe-zone combined" style={{ inset: `${combined.top * 100}% ${combined.right * 100}% ${combined.bottom * 100}% ${combined.left * 100}%`, '--zc': '#ffd400' } as CSSProperties}>
              <span>{visibleZones.map((z) => z.name.split(' ')[0]).join(', ')}</span>
            </div>
          )}
          {imageEditing && (
            <ImageEditor project={project} assets={assets} selection={selection} t={t} li={activeLayer} keep={keep} onPatches={onPatches}
              toCanvas={(e) => { const r = wrapRef.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * w, y: ((e.clientY - r.top) / r.height) * h }; }} />
          )}
          {editSlot && (
            <div className="slot-edit" style={{ left: `${project.stage.slot.x * 100}%`, top: `${project.stage.slot.y * 100}%`, width: `${project.stage.slot.w * 100}%`, height: `${project.stage.slot.h * 100}%` }}
              onPointerDown={(e) => slotDown(e, 'move')} onPointerMove={slotMove} onPointerUp={() => { slotDrag.current = null; }} onPointerCancel={() => { slotDrag.current = null; }}
              onDoubleClick={(e) => e.stopPropagation()}>
              {HANDLES.map((hd) => (
                <i key={hd} className={`hd hd-${hd}`} onPointerDown={(e) => slotDown(e, hd)} />
              ))}
            </div>
          )}
          <span className="cap bottom">{presetLabel} · {w}×{h} · {pct}%</span>
        </div>
        {empty && <div className="empty">Add images to see the preview</div>}
        <div className="zoombar histbar" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          <button disabled={!canUndo} onClick={onUndo} aria-label="Undo" data-tip="Undo · ⌘ Z">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden><path d="M6 3L2.5 6.5 6 10M3 6.5h6.5a4 4 0 0 1 0 8H7" /></svg>
          </button>
          <button disabled={!canRedo} onClick={onRedo} aria-label="Redo" data-tip="Redo · ⌘ ⇧ Z">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden><path d="M10 3l3.5 3.5L10 10M13 6.5H6.5a4 4 0 0 0 0 8H9" /></svg>
          </button>
        </div>
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
