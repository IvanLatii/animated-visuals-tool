import { useRef, type PointerEvent as RPointerEvent } from 'react';
import type { Project } from '../model/types';
import { layerBounds } from '../render/layerGeometry';
import type { Assets } from '../render/renderScene';

interface Props {
  project: Project;
  assets: Assets;
  selection: string[];
  keep: boolean; // замок пропорцій
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
  w0: number; h0: number; theta: number; c: { x: number; y: number };
  sw: number; sh: number; multi: boolean;
}

const HANDLES: { name: string; hx: number; hy: number }[] = [
  { name: 'nw', hx: -1, hy: -1 }, { name: 'n', hx: 0, hy: -1 }, { name: 'ne', hx: 1, hy: -1 }, { name: 'e', hx: 1, hy: 0 },
  { name: 'se', hx: 1, hy: 1 }, { name: 's', hx: 0, hy: 1 }, { name: 'sw', hx: -1, hy: 1 }, { name: 'w', hx: -1, hy: 0 },
];
const clampScale = (v: number) => Math.min(8, Math.max(0.05, v));
const norm = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/** Рамка вибраного зображення на артборді: тягнути всередині — рухає, за маркери — змінює розмір, за кружечок зверху — повертає. */
export function ImageEditor({ project, assets, selection, keep, toCanvas, onPatches }: Props) {
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
  const cx = ox + b.cx, cy = oy + b.cy;

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
    d.current = { kind, hx, hy, start: toCanvas(e), snap, w0: b.w, h0: b.h, theta: (b.rot * Math.PI) / 180, c: { x: cx, y: cy }, sw, sh, multi: selection.length > 1 };
  };

  const move = (e: RPointerEvent) => {
    const s = d.current;
    if (!s) return;
    const p = toCanvas(e);
    const ddx = p.x - s.start.x, ddy = p.y - s.start.y;
    const patches: Record<string, { scaleX?: number; scaleY?: number; dx?: number; dy?: number; rotation?: number }> = {};

    if (s.kind === 'move') {
      for (const [id, v] of Object.entries(s.snap)) patches[id] = { dx: v.dx + ddx / s.sw, dy: v.dy + ddy / s.sh };
    } else if (s.kind === 'rotate') {
      const delta = ((Math.atan2(p.y - s.c.y, p.x - s.c.x) - Math.atan2(s.start.y - s.c.y, s.start.x - s.c.x)) * 180) / Math.PI;
      for (const [id, v] of Object.entries(s.snap)) {
        const raw = v.rot + delta;
        patches[id] = { rotation: norm(e.shiftKey ? Math.round(raw / 15) * 15 : raw) }; // Shift — крок 15°
      }
    } else {
      // Зсув у локальних осях рамки (з урахуванням її повороту)
      const cos = Math.cos(s.theta), sin = Math.sin(s.theta);
      const ldx = ddx * cos + ddy * sin, ldy = -ddx * sin + ddy * cos;
      const k = s.multi ? 2 : 1; // кілька виділених масштабуються навколо власних центрів, один — від протилежного краю
      let fx = s.hx !== 0 ? Math.max(0.05, (s.w0 + s.hx * ldx * k) / s.w0) : 1;
      let fy = s.hy !== 0 ? Math.max(0.05, (s.h0 + s.hy * ldy * k) / s.h0) : 1;
      if (keep) {
        if (s.hx !== 0 && s.hy !== 0) fx = fy = (fx + fy) / 2;
        else if (s.hx !== 0) fy = fx;
        else fx = fy;
      }
      let shiftX = 0, shiftY = 0;
      if (!s.multi) {
        const lx = s.hx !== 0 ? (s.hx * (s.w0 * fx - s.w0)) / 2 : 0;
        const ly = s.hy !== 0 ? (s.hy * (s.h0 * fy - s.h0)) / 2 : 0;
        shiftX = lx * cos - ly * sin;
        shiftY = lx * sin + ly * cos;
      }
      for (const [id, v] of Object.entries(s.snap)) {
        patches[id] = { scaleX: clampScale(v.sx * fx), scaleY: clampScale(v.sy * fy), ...(s.multi ? {} : { dx: v.dx + shiftX / s.sw, dy: v.dy + shiftY / s.sh }) };
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
      left: `${((cx - b.w / 2) / cw) * 100}%`, top: `${((cy - b.h / 2) / ch) * 100}%`,
      width: `${(b.w / cw) * 100}%`, height: `${(b.h / ch) * 100}%`, transform: `rotate(${b.rot}deg)`,
    }} {...bind('move')} onDoubleClick={(e) => e.stopPropagation()}>
      {HANDLES.map((h) => <i key={h.name} className={`hd hd-${h.name}`} {...bind('resize', h.hx, h.hy)} />)}
      <i className="hd hd-rot" {...bind('rotate')} />
    </div>
  );
}
