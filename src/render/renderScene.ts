import { loadImage } from '../assets';
import { baseBox } from './layerGeometry';
import { resolveFrame, type ResolvedFrame } from '../model/defaults';
import type { Layer, Project } from '../model/types';
import { applyEasing } from './easing';
import { motions } from './effects';
import { transitions, type Size } from './transitions';

/** Завантажені зображення за src. Малювання не чекає на мережу, тож усе вантажимо наперед. */
export type Assets = Map<string, CanvasImageSource & { width: number; height: number }>;

export async function loadAssets(project: Project): Promise<Assets> {
  const assets: Assets = new Map();
  const srcs = new Set(project.frames.flatMap((f) => f.layers.map((l) => l.src)));
  if (project.stage.background) srcs.add(project.stage.background);
  if (project.stage.overlay) srcs.add(project.stage.overlay);
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

function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, fit: 'fit' | 'fill', assets: Assets, size: Size) {
  const img = assets.get(layer.src);
  if (!img) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high'; // без цього повільний зум дрібно «мерехтить»
  const { w: W, h: H } = size;
  const b = baseBox(layer, fit, img, W, H);
  ctx.save();
  // Власне перетворення навколо центру шару; обрізання по прямокутнику шару рухається разом із зображенням.
  ctx.translate(b.cx + (layer.dx ?? 0) * W, b.cy + (layer.dy ?? 0) * H);
  ctx.rotate(((layer.rotation ?? 0) * Math.PI) / 180);
  ctx.scale(layer.scaleX ?? 1, layer.scaleY ?? 1);
  ctx.translate(-b.cx, -b.cy);
  ctx.beginPath(); ctx.rect(b.rx, b.ry, b.rw, b.rh); ctx.clip();
  ctx.drawImage(img, b.rx + (b.rw - b.w) / 2, b.ry + (b.rh - b.h) / 2, b.w, b.h);
  ctx.restore();
}

function drawFrame(ctx: CanvasRenderingContext2D, rf: ResolvedFrame, fitDefault: 'fit' | 'fill', progress: number, assets: Assets, size: Size) {
  const { w: W, h: H } = size;
  const tr = motions[rf.motion.type](rf.motion, progress, { w: W, h: H });
  ctx.save();
  ctx.translate(W / 2 + tr.dx * W, H / 2 + tr.dy * H);
  ctx.rotate(tr.rotate);
  ctx.scale(tr.scale, tr.scale);
  ctx.translate(-W / 2, -H / 2);
  if (tr.blur) ctx.filter = `blur(${(tr.blur * W).toFixed(2)}px)`;
  if (tr.alpha !== undefined && tr.alpha < 1) ctx.globalAlpha *= Math.max(0, tr.alpha);
  for (const layer of rf.frame.layers) drawLayer(ctx, layer, layer.fit ?? fitDefault, assets, size);
  ctx.restore();
}

/**
 * Єдина функція малювання: прев'ю й експорти викликають тільки її.
 * Статична картинка = t = 0. Розмір у пікселях береться з canvas.
 */
/** Картинка на весь прямокутник із збереженням пропорцій (зайве обрізається). */
function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, w: number, h: number) {
  const k = Math.max(w / img.width, h / img.height);
  const iw = img.width * k, ih = img.height * k;
  ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.roundRect(x, y, w, h, r);
}

/**
 * Єдина функція малювання: прев'ю й експорти викликають тільки її.
 * Статична картинка = t = 0. Розмір у пікселях береться з canvas.
 * Шари знизу вгору: колір і картинка фону → тінь вікна → кадри (обрізані вікном) → накладка.
 */
export function renderScene(project: Project, t: number, canvas: HTMLCanvasElement, assets: Assets): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = project.canvas.background;
  ctx.fillRect(0, 0, W, H);
  const { stage } = project;
  const bg = stage.background ? assets.get(stage.background) : undefined;
  if (bg) drawCover(ctx, bg, W, H);

  const drawOverlay = () => {
    const ov = stage.overlay ? assets.get(stage.overlay) : undefined;
    if (ov) drawCover(ctx, ov, W, H);
  };

  const fitDefault = project.defaults.layerFit;
  const { items, total } = buildTimeline(project);
  if (!items.length) { drawOverlay(); return; }
  const time = Math.min(Math.max(t, 0), total);

  // Вікно вмісту
  const sx = stage.slot.x * W, sy = stage.slot.y * H, sw = stage.slot.w * W, sh = stage.slot.h * H;
  const r = Math.max(0, Math.min(stage.radius * W, sw / 2, sh / 2));
  const size: Size = { w: sw, h: sh };

  if (stage.shadow > 0) {
    // Тінь лише ззовні вікна: вирізаємо саме вікно (evenodd), щоб заливка не просвічувала крізь кадри.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    roundRectPath(ctx, sx, sy, sw, sh, r);
    ctx.clip('evenodd');
    ctx.shadowColor = `rgba(0, 0, 0, ${0.55 * stage.shadow})`;
    ctx.shadowBlur = 0.05 * W * stage.shadow;
    ctx.shadowOffsetY = 0.012 * W * stage.shadow;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    roundRectPath(ctx, sx, sy, sw, sh, r);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, sx, sy, sw, sh, r);
  ctx.clip();
  ctx.translate(sx, sy);

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
      () => drawFrame(ctx, prev.rf, fitDefault, progressOf(prev), assets, size),
      () => drawFrame(ctx, cur.rf, fitDefault, progressOf(cur), assets, size),
      size,
    );
  } else {
    drawFrame(ctx, cur.rf, fitDefault, progressOf(cur), assets, size);
  }
  ctx.restore();
  drawOverlay();
}
