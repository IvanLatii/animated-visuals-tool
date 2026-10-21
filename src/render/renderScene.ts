import { loadImage } from '../assets';
import { resolveFrame, type ResolvedFrame } from '../model/defaults';
import type { Layer, Project } from '../model/types';
import { applyEasing } from './easing';
import { motions } from './effects';
import { transitions } from './transitions';

/** Завантажені зображення за src. Малювання не чекає на мережу, тож усе вантажимо наперед. */
export type Assets = Map<string, CanvasImageSource & { width: number; height: number }>;

export async function loadAssets(project: Project): Promise<Assets> {
  const assets: Assets = new Map();
  const srcs = new Set(project.frames.flatMap((f) => f.layers.map((l) => l.src)));
  await Promise.all([...srcs].map(async (src) => {
    assets.set(src, await loadImage(src));
  }));
  return assets;
}

interface Timeline { items: { rf: ResolvedFrame; start: number; end: number; transIn: number }[]; total: number }

/** Кадр i показується від (start − тривалість переходу всередину) до end. Загальна тривалість = сума тривалостей. */
export function buildTimeline(project: Project): Timeline {
  const rfs = project.frames.map((f) => resolveFrame(project, f));
  let cursor = 0;
  const items = rfs.map((rf, i) => {
    const start = cursor;
    const end = start + rf.duration;
    cursor = end;
    const prev = rfs[i - 1];
    let transIn = 0;
    if (prev && prev.transitionOut.type !== 'cut') {
      transIn = Math.min(prev.transitionOut.duration, prev.duration, rf.duration);
    }
    return { rf, start, end, transIn };
  });
  return { items, total: cursor };
}

export function projectDuration(project: Project): number {
  return buildTimeline(project).total;
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, fit: 'fit' | 'fill', assets: Assets) {
  const img = assets.get(layer.src);
  if (!img) return;
  const { width: W, height: H } = ctx.canvas;
  const rx = layer.x * W, ry = layer.y * H, rw = layer.w * W, rh = layer.h * H;
  const k = fit === 'fill'
    ? Math.max(rw / img.width, rh / img.height)
    : Math.min(rw / img.width, rh / img.height);
  const w = img.width * k, h = img.height * k;
  ctx.save();
  ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
  ctx.drawImage(img, rx + (rw - w) / 2, ry + (rh - h) / 2, w, h);
  ctx.restore();
}

function drawFrame(ctx: CanvasRenderingContext2D, rf: ResolvedFrame, fitDefault: 'fit' | 'fill', progress: number, assets: Assets) {
  const { width: W, height: H } = ctx.canvas;
  const tr = motions[rf.motion.type](rf.motion, progress, { w: W, h: H });
  ctx.save();
  ctx.translate(W / 2 + tr.dx * W, H / 2 + tr.dy * H);
  ctx.rotate(tr.rotate);
  ctx.scale(tr.scale, tr.scale);
  ctx.translate(-W / 2, -H / 2);
  for (const layer of rf.frame.layers) drawLayer(ctx, layer, layer.fit ?? fitDefault, assets);
  ctx.restore();
}

/**
 * Єдина функція малювання: прев'ю й експорти викликають тільки її.
 * Статична картинка = t = 0. Розмір у пікселях береться з canvas.
 */
export function renderScene(project: Project, t: number, canvas: HTMLCanvasElement, assets: Assets): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = project.canvas.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const fitDefault = project.defaults.layerFit;
  const { items, total } = buildTimeline(project);
  if (!items.length) return;
  const time = Math.min(Math.max(t, 0), total);

  // Активний кадр: останній, що вже почався (з урахуванням переходу всередину).
  let idx = 0;
  for (let i = 0; i < items.length; i++) if (time >= items[i].start - items[i].transIn) idx = i;
  const cur = items[idx];
  const progressOf = (it: Timeline['items'][number]) => {
    const from = it.start - it.transIn;
    return (time - from) / Math.max(1e-6, it.end - from);
  };

  const prev = items[idx - 1];
  const inTransition = prev && cur.transIn > 0 && time < cur.start;
  if (inTransition) {
    const p = (time - (cur.start - cur.transIn)) / cur.transIn;
    const tr = prev.rf.transitionOut;
    transitions[tr.type](
      ctx,
      applyEasing(tr.easing, p),
      () => drawFrame(ctx, prev.rf, fitDefault, progressOf(prev), assets),
      () => drawFrame(ctx, cur.rf, fitDefault, progressOf(cur), assets),
    );
  } else {
    drawFrame(ctx, cur.rf, fitDefault, progressOf(cur), assets);
  }
}
