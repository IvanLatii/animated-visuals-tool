import { useRef, type PointerEvent as RPointerEvent } from 'react';
import type { Project } from '../model/types';
import { layerBounds } from '../render/layerGeometry';
import { motions } from '../render/effects';
import { buildTimeline, type Assets } from '../render/renderScene';

interface Props {
  project: Project;
  assets: Assets;
  selection: string[];
  t: number; // момент сцени: рамка враховує рух кадру, тож збігається з тим, що видно
  keep: boolean; // замок пропорцій (Shift вмикає пропорції на час перетягування)
  /** Екранна точка → піксель полотна (з урахуванням масштабу й панорами). */
  toCanvas: (e: { clientX: number; clientY: number }) => { x: number; y: number };
  onPatches: (patches: Record<string, { scaleX?: number; scaleY?: number; dx?: number; dy?: number; rotation?: number }>) => void;
}

type Kind = 'move' | 'resize' | 'rotate';
interface Snap { sx: number; sy: number; dx: number; dy: number; rot: number }
interface Drag {
  kind: Kind; hx: number; hy: number;
  start: { x: number; y: number };
  snap: Record<string, Snap>;
  w0: number; h0: number; // показані розміри (з рухом)
  theta: number; // повний кут рамки: власний поворот + поворот руху
  ms: number; mr: number; // масштаб і поворот руху кадру
  c: { x: number; y: number }; // показаний центр, піксель полотна
  sw: number; sh: number; multi: boolean;
}

const HANDLES: { name: string; hx: number; hy: number }[] = [
  { name: 'nw', hx: -1, hy: -1 }, { name: 'n', hx: 0, hy: -1 }, { name: 'ne', hx: 1, hy: -1 }, { name: 'e', hx: 1, hy: 0 },
  { name: 'se', hx: 1, hy: 1 }, { name: 's', hx: 0, hy: 1 }, { name: 'sw', hx: -1, hy: 1 }, { name: 'w', hx: -1, hy: 0 },
];
const clampScale = (v: number) => Math.min(8, Math.max(0.05, v));
const norm = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Рамка вибраного зображення на артборді: тягнути всередині — рухає, за маркери — змінює розмір, за кружечок зверху — повертає. */
export function ImageEditor({ project, assets, selection, t, keep, toCanvas, onPatches }: Props) {
  const d = useRef<Drag | null>(null); // поточне перетягування живе між подіями вказівника

  const primary = project.frames.find((f) => f.id === selection[selection.length - 1]);
  const layer = primary?.layers[0];
  const img = layer ? assets.get(layer.src) : undefined;
  if (!primary || !layer || !img) return null;

  const { slot } = project.stage;
  const cw = project.canvas.w, ch = project.canvas.h;
  const sw = slot.w * cw, sh = slot.h * ch, ox = slot.x * cw, oy = slot.y * ch;
  const fit = layer.fit ?? project.defaults.layerFit;
  const b = layerBounds(layer, fit, img, sw, sh);

  // Рух кадру в цей момент: рамка малюється там, де зображення видно зараз.
  const item = buildTimeline(project).items.find((it) => it.rf.frame.id === primary.id);
  const progress = item ? clamp01((t - (item.start - item.transIn)) / Math.max(1e-6, item.end - (item.start - item.transIn))) : 0;
  const tr = item ? motions[item.rf.motion.type](item.rf.motion, progress, { w: sw, h: sh }) : { scale: 1, dx: 0, dy: 0, rotate: 0 };
  const cosM = Math.cos(tr.rotate), sinM = Math.sin(tr.rotate);
  const relX = b.cx - sw / 2, relY = b.cy - sh / 2;
  const cx = ox + sw / 2 + tr.dx * sw + tr.scale * (relX * cosM - relY * sinM);
  const cy = oy + sh / 2 + tr.dy * sh + tr.scale * (relX * sinM + relY * cosM);
  const dispW = b.w * tr.scale, dispH = b.h * tr.scale;
  const dispRot = b.rot + (tr.rotate * 180) / Math.PI;

  /** Зсув у пікселях полотна → зсув у системі шару (без руху кадру). */
  const toLayer = (s: Drag, x: number, y: number) => ({
    x: (x * Math.cos(s.mr) + y * Math.sin(s.mr)) / s.ms,
    y: (-x * Math.sin(s.mr) + y * Math.cos(s.mr)) / s.ms,
  });

  const down = (e: RPointerEvent, kind: Kind, hx = 0, hy = 0) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* штучна подія без реального вказівника */ }
    const snap: Record<string, Snap> = {};
    for (const f of project.frames) {
      if (!selection.includes(f.id) || !f.layers[0]) continue;
      const l = f.layers[0];
      snap[f.id] = { sx: l.scaleX ?? 1, sy: l.scaleY ?? 1, dx: l.dx ?? 0, dy: l.dy ?? 0, rot: l.rotation ?? 0 };
    }
    d.current = {
      kind, hx, hy, start: toCanvas(e), snap, w0: dispW, h0: dispH, theta: (dispRot * Math.PI) / 180,
      ms: tr.scale, mr: tr.rotate, c: { x: cx, y: cy }, sw, sh, multi: selection.length > 1,
    };
  };

  const move = (e: RPointerEvent) => {
    const s = d.current;
    if (!s) return;
    const p = toCanvas(e);
    const ddx = p.x - s.start.x, ddy = p.y - s.start.y;
    const patches: Record<string, { scaleX?: number; scaleY?: number; dx?: number; dy?: number; rotation?: number }> = {};

    if (s.kind === 'move') {
      const v = toLayer(s, ddx, ddy);
      for (const [id, k] of Object.entries(s.snap)) patches[id] = { dx: k.dx + v.x / s.sw, dy: k.dy + v.y / s.sh };
    } else if (s.kind === 'rotate') {
      const delta = ((Math.atan2(p.y - s.c.y, p.x - s.c.x) - Math.atan2(s.start.y - s.c.y, s.start.x - s.c.x)) * 180) / Math.PI;
      for (const [id, k] of Object.entries(s.snap)) {
        const raw = k.rot + delta;
        patches[id] = { rotation: norm(e.shiftKey ? Math.round(raw / 15) * 15 : raw) }; // Shift — крок 15°
      }
    } else {
      // Зсув у локальних осях рамки (з урахуванням її повного повороту)
      const cos = Math.cos(s.theta), sin = Math.sin(s.theta);
      const ldx = ddx * cos + ddy * sin, ldy = -ddx * sin + ddy * cos;
      const k2 = s.multi ? 2 : 1; // кілька виділених масштабуються навколо власних центрів, один — від протилежного краю
      let fx = s.hx !== 0 ? Math.max(0.05, (s.w0 + s.hx * ldx * k2) / s.w0) : 1;
      let fy = s.hy !== 0 ? Math.max(0.05, (s.h0 + s.hy * ldy * k2) / s.h0) : 1;
      if (keep || e.shiftKey) { // замок пропорцій або Shift
        if (s.hx !== 0 && s.hy !== 0) fx = fy = (fx + fy) / 2;
        else if (s.hx !== 0) fy = fx;
        else fx = fy;
      }
      let shiftX = 0, shiftY = 0;
      if (!s.multi) {
        const lx = s.hx !== 0 ? (s.hx * (s.w0 * fx - s.w0)) / 2 : 0;
        const ly = s.hy !== 0 ? (s.hy * (s.h0 * fy - s.h0)) / 2 : 0;
        const v = toLayer(s, lx * cos - ly * sin, lx * sin + ly * cos);
        shiftX = v.x; shiftY = v.y;
      }
      for (const [id, k] of Object.entries(s.snap)) {
        patches[id] = { scaleX: clampScale(k.sx * fx), scaleY: clampScale(k.sy * fy), ...(s.multi ? {} : { dx: k.dx + shiftX / s.sw, dy: k.dy + shiftY / s.sh }) };
      }
    }
    onPatches(patches);
  };

  const end = () => { d.current = null; };
  const bind = (kind: Kind, hx = 0, hy = 0) => ({
    onPointerDown: (e: RPointerEvent) => down(e, kind, hx, hy), onPointerMove: move, onPointerUp: end, onPointerCancel: end,
  });

  return (
    <div className="img-edit" style={{
      left: `${((cx - dispW / 2) / cw) * 100}%`, top: `${((cy - dispH / 2) / ch) * 100}%`,
      width: `${(dispW / cw) * 100}%`, height: `${(dispH / ch) * 100}%`, transform: `rotate(${dispRot}deg)`,
    }} {...bind('move')} onDoubleClick={(e) => e.stopPropagation()}>
      {HANDLES.map((h) => <i key={h.name} className={`hd hd-${h.name}`} {...bind('resize', h.hx, h.hy)} />)}
      <i className="hd hd-rot" {...bind('rotate')} />
    </div>
  );
}
