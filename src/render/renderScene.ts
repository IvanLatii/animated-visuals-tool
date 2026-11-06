import { loadImage } from '../assets';
import { isClip, restoreClip, type ClipAsset } from '../media/clipAsset';
import { baseBox } from './layerGeometry';
import { clipSourceTime, resolveFrame, type ResolvedFrame } from '../model/defaults';
import type { Layer, Project } from '../model/types';
import { applyEasing } from './easing';
import { renderAscii, resolveAscii } from './ascii';
import { motions } from './effects';
import { transitions, type Size } from './transitions';

/** Завантажені зображення за src. Малювання не чекає на мережу, тож усе вантажимо наперед. */
export type Asset = (CanvasImageSource & { width: number; height: number }) | ClipAsset;
export type Assets = Map<string, Asset>;

export async function loadAssets(project: Project): Promise<Assets> {
  const assets: Assets = new Map();
  const layers = project.frames.flatMap((f) => f.layers);
  const srcs = new Set(layers.map((l) => l.src));
  if (project.stage.background) srcs.add(project.stage.background);
  if (project.stage.overlay) srcs.add(project.stage.overlay);
  const clipKinds = new Map(layers.filter((l) => l.clip).map((l) => [l.src, l.clip!.kind] as const));
  await Promise.all([...srcs].map(async (src) => {
    const kind = clipKinds.get(src);
    assets.set(src, kind ? await restoreClip(src, kind) : await loadImage(src));
  }));
  return assets;
}

/** Кадри з відео/GIF для кожного шару в момент t (секунди сцени): [актив, момент у джерелі]. */
function clipsAt(project: Project, t: number, assets: Assets): [ClipAsset, number][] {
  const out: [ClipAsset, number][] = [];
  const { items, total } = buildTimeline(project);
  const time = Math.min(Math.max(t, 0), total);
  for (const it of items) {
    if (time < it.start - it.transIn || time > it.end) continue;
    for (const l of it.rf.frame.layers) {
      const a = l.clip ? assets.get(l.src) : undefined;
      if (l.clip && isClip(a)) out.push([a, clipSourceTime(l.clip, time - it.start)]);
    }
  }
  return out;
}

/** Експорт: дочекатися декодування всіх відео-кадрів, потрібних у момент t, перед синхронним renderScene. */
export async function prepareClips(project: Project, t: number, assets: Assets): Promise<void> {
  await Promise.all(clipsAt(project, t, assets).map(([a, st]) => a.ensure(st)));
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

function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, fit: 'fit' | 'fill', assets: Assets, size: Size, frameT: number) {
  const asset = assets.get(layer.src);
  if (!asset) return;
  const source: CanvasImageSource = isClip(asset) ? asset.peek(layer.clip ? clipSourceTime(layer.clip, frameT) : 0) : asset;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high'; // без цього повільний зум дрібно «мерехтить»
  const { w: W, h: H } = size;
  const b = baseBox(layer, fit, asset, W, H);
  ctx.save();
  // Власне перетворення навколо центру шару; обрізання по прямокутнику шару рухається разом із зображенням.
  ctx.translate(b.cx + (layer.dx ?? 0) * W, b.cy + (layer.dy ?? 0) * H);
  ctx.rotate(((layer.rotation ?? 0) * Math.PI) / 180);
  ctx.scale(layer.scaleX ?? 1, layer.scaleY ?? 1);
  ctx.translate(-b.cx, -b.cy);
  ctx.beginPath(); ctx.rect(b.rx, b.ry, b.rw, b.rh); ctx.clip();
  ctx.drawImage(source, b.rx + (b.rw - b.w) / 2, b.ry + (b.rh - b.h) / 2, b.w, b.h);
  ctx.restore();
}

const scratch = { src: null as HTMLCanvasElement | null, out: null as HTMLCanvasElement | null };

/** Кадр з увімкненим ASCII: малюємо звичайно в тимчасове полотно, потім замінюємо символами. ctx лишається з поточним станом (перехід міг його змінити). */
function drawFrame(ctx: CanvasRenderingContext2D, rf: ResolvedFrame, fitDefault: 'fit' | 'fill', progress: number, assets: Assets, size: Size, frameT: number, noMotion = false) {
  const ascii = rf.frame.ascii?.enabled ? resolveAscii(rf.frame.ascii) : null;
  if (!ascii) return drawFrameImage(ctx, rf, fitDefault, progress, assets, size, frameT, noMotion);
  const w = Math.max(1, Math.round(size.w)), h = Math.max(1, Math.round(size.h));
  const src = (scratch.src ??= document.createElement('canvas'));
  const out = (scratch.out ??= document.createElement('canvas'));
  src.width = w; src.height = h; out.width = w; out.height = h; // зміна розміру ще й очищає
  drawFrameImage(src.getContext('2d')!, rf, fitDefault, progress, assets, size, frameT, noMotion);
  renderAscii(src, out, ascii);
  ctx.drawImage(out, 0, 0, size.w, size.h);
}

function drawFrameImage(ctx: CanvasRenderingContext2D, rf: ResolvedFrame, fitDefault: 'fit' | 'fill', progress: number, assets: Assets, size: Size, frameT: number, noMotion = false) {
  const { w: W, h: H } = size;
  const tr = noMotion ? { scale: 1, dx: 0, dy: 0, rotate: 0 } : motions[rf.motion.type](rf.motion, progress, { w: W, h: H });
  ctx.save();
  ctx.translate(W / 2 + tr.dx * W, H / 2 + tr.dy * H);
  ctx.rotate(tr.rotate);
  ctx.scale(tr.scale, tr.scale);
  ctx.translate(-W / 2, -H / 2);
  if (tr.blur) ctx.filter = `blur(${(tr.blur * W).toFixed(2)}px)`;
  if (tr.alpha !== undefined && tr.alpha < 1) ctx.globalAlpha *= Math.max(0, tr.alpha);
  for (const layer of rf.frame.layers) drawLayer(ctx, layer, layer.fit ?? fitDefault, assets, size, frameT);
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
/** opts.noMotion — малює без руху кадру: для редагування розташування зображень мишею (рамка збігається з картинкою). */
export function renderScene(project: Project, t: number, canvas: HTMLCanvasElement, assets: Assets, opts: { noMotion?: boolean } = {}): void {
  const noMotion = opts.noMotion ?? false;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = project.canvas.background;
  ctx.fillRect(0, 0, W, H);
  const { stage } = project;
  const bg = stage.background ? assets.get(stage.background) : undefined;
  if (bg && !isClip(bg)) drawCover(ctx, bg, W, H); // фон і накладка лише статичні

  const drawOverlay = () => {
    const ov = stage.overlay ? assets.get(stage.overlay) : undefined;
    if (ov && !isClip(ov)) drawCover(ctx, ov, W, H);
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
      () => drawFrame(ctx, prev.rf, fitDefault, progressOf(prev), assets, size, Math.max(0, time - prev.start), noMotion),
      () => drawFrame(ctx, cur.rf, fitDefault, progressOf(cur), assets, size, Math.max(0, time - cur.start), noMotion),
      size,
    );
  } else {
    drawFrame(ctx, cur.rf, fitDefault, progressOf(cur), assets, size, Math.max(0, time - cur.start), noMotion);
  }
  ctx.restore();
  drawOverlay();
}
