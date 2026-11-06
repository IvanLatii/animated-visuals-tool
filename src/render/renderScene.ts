import { loadImage } from '../assets';
import { isClip, restoreClip, type ClipAsset } from '../media/clipAsset';
import { baseBox, fillBox } from './layerGeometry';
import { clipSourceTime, resolveFrame, type ResolvedFrame } from '../model/defaults';
import type { Layer, Project } from '../model/types';
import { applyEasing } from './easing';
import { renderAscii, resolveAscii } from './ascii';
import { motions } from './effects';
import { transitions, type Size } from './transitions';

/** Завантажені зображення за src. Малювання не чекає на мережу, тож усе вантажимо наперед. */
export type Asset = (CanvasImageSource & { width: number; height: number }) | ClipAsset;
export type Assets = Map<string, Asset>;

/** Зображення шару для геометрії й рамки: файл із assets, а для заливки — прямокутник розміром із шар. */
export function layerAsset(layer: Layer, assets: Assets, W: number, H: number): { width: number; height: number } | undefined {
  return layer.fill ? fillBox(layer, W, H) : assets.get(layer.src);
}

export async function loadAssets(project: Project): Promise<Assets> {
  const assets: Assets = new Map();
  const layers = project.frames.flatMap((f) => f.layers).filter((l) => !l.fill); // заливкам файл не потрібен
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
  const tl = buildTimeline(project);
  const { items, total } = tl;
  const time = Math.min(Math.max(t, 0), total);
  const wrap = loopBackDuration(project, tl);
  if (wrap > 0 && time > total - wrap) { // у кінці на екрані ще й початок першого кадру
    for (const l of items[0].rf.frame.layers) {
      const a = l.clip ? assets.get(l.src) : undefined;
      if (l.clip && isClip(a)) out.push([a, clipSourceTime(l.clip, 0)]);
    }
  }
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

/** Скільки секунд наприкінці йде перехід від останнього кадру до першого (0 — немає). */
function loopBackDuration(project: Project, tl: Timeline): number {
  const first = tl.items[0], last = tl.items[tl.items.length - 1];
  if (!project.defaults.loopBack || tl.items.length < 2 || last.rf.transitionOut.type === 'cut') return 0;
  return Math.min(last.rf.transitionOut.duration, last.rf.duration, first.rf.duration);
}

export function projectDuration(project: Project): number {
  return buildTimeline(project).total;
}

/** Прямокутник зі скругленими кутами. smooth > 0 подовжує перехід кута в бік (як «corner smoothing» у Figma / iOS): 🟡 наближення, не точна формула Figma. */
function smoothRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, smooth: number) {
  const r = Math.min(radius, w / 2, h / 2);
  if (r <= 0) { ctx.rect(x, y, w, h); return; }
  const e = Math.min(r * (1 + smooth), w / 2, h / 2), c = r * 0.4477; // e — де кривa починається на стороні, c — відстань контрольної точки від кута
  ctx.moveTo(x + e, y);
  ctx.lineTo(x + w - e, y);
  ctx.bezierCurveTo(x + w - c, y, x + w, y + c, x + w, y + e);
  ctx.lineTo(x + w, y + h - e);
  ctx.bezierCurveTo(x + w, y + h - c, x + w - c, y + h, x + w - e, y + h);
  ctx.lineTo(x + e, y + h);
  ctx.bezierCurveTo(x + c, y + h, x, y + h - c, x, y + h - e);
  ctx.lineTo(x, y + e);
  ctx.bezierCurveTo(x, y + c, x + c, y, x + e, y);
  ctx.closePath();
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, fit: 'fit' | 'fill', assets: Assets, size: Size, frameT: number) {
  if (layer.fill) { // заливка кольором: той самий поворот / розтягування / зсув, але без картинки
    const { w: W, h: H } = size;
    const b = baseBox(layer, 'fill', fillBox(layer, W, H), W, H);
    ctx.save();
    ctx.translate(b.cx + (layer.dx ?? 0) * W, b.cy + (layer.dy ?? 0) * H);
    ctx.rotate(((layer.rotation ?? 0) * Math.PI) / 180);
    ctx.scale(layer.scaleX ?? 1, layer.scaleY ?? 1);
    ctx.translate(-b.cx, -b.cy);
    ctx.fillStyle = layer.fill;
    ctx.beginPath(); smoothRectPath(ctx, b.rx, b.ry, b.rw, b.rh, (layer.radius ?? 0) * Math.min(b.rw, b.rh), layer.smooth ?? 0.6); ctx.fill();
    ctx.restore();
    return;
  }
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
  // Скруглення накладається на видиму область зображення (для fit — саме зображення, для fill — рамка шару)
  const vw = Math.min(b.w, b.rw), vh = Math.min(b.h, b.rh);
  ctx.beginPath(); smoothRectPath(ctx, b.cx - vw / 2, b.cy - vh / 2, vw, vh, (layer.radius ?? 0) * Math.min(vw, vh), layer.smooth ?? 0.6); ctx.clip();
  ctx.drawImage(source, b.rx + (b.rw - b.w) / 2, b.ry + (b.rh - b.h) / 2, b.w, b.h);
  ctx.restore();
}

const scratch = { src: null as HTMLCanvasElement | null, out: null as HTMLCanvasElement | null, flat: null as HTMLCanvasElement | null, flat2: null as HTMLCanvasElement | null };

function scratchCanvas(key: 'flat' | 'flat2', w: number, h: number): HTMLCanvasElement {
  const c = (scratch[key] ??= document.createElement('canvas'));
  c.width = w; c.height = h; // зміна розміру ще й очищає
  return c;
}

/**
 * Псевдо-3D: повертає плоский кадр навколо осі смужками з перспективою (кожна смужка свого масштабу). persp 0–0.6 — сила перспективи.
 * Зворотний бік (кут > 90°) виходить дзеркальним, як у картки. Малює в ctx у координатах кадру 0..W × 0..H.
 */
function projectAxis(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, W: number, H: number, angle: number, persp: number, axis: 'y' | 'x') {
  const len = axis === 'y' ? W : H, cross = axis === 'y' ? H : W;
  const d = len / (persp * 1.5 + 0.15); // відстань до «камери»
  const step = Math.max(1, Math.round(len / 600));
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const proj = (u: number) => { const s = d / Math.max(0.05 * d, d - u * sin); return { pos: u * cos * s, s }; };
  for (let a = 0; a < len; a += step) {
    const u0 = a - len / 2, u1 = Math.min(len, a + step) - len / 2;
    const p0 = proj(u0), p1 = proj(u1);
    const s = (p0.s + p1.s) / 2, size = cross * s;
    const x0 = len / 2 + Math.min(p0.pos, p1.pos), w = Math.abs(p1.pos - p0.pos) + 0.75;
    const y0 = cross / 2 - size / 2;
    if (axis === 'y') ctx.drawImage(src, a, 0, Math.min(step, len - a), cross, x0, y0, w, size);
    else ctx.drawImage(src, 0, a, cross, Math.min(step, len - a), y0, x0, size, w);
  }
}

/** Кадр з увімкненим ASCII: малюємо звичайно в тимчасове полотно, потім замінюємо символами. ctx лишається з поточним станом (перехід міг його змінити). */
function drawFrame(ctx: CanvasRenderingContext2D, rf: ResolvedFrame, fitDefault: 'fit' | 'fill', progress: number, assets: Assets, size: Size, frameT: number, noMotion = false) {
  const ascii = rf.frame.ascii?.enabled ? resolveAscii(rf.frame.ascii) : null;
  if (!ascii) return drawFrameImage(ctx, rf, fitDefault, progress, assets, size, frameT, noMotion);
  const w = Math.max(1, Math.round(size.w)), h = Math.max(1, Math.round(size.h));
  const src = (scratch.src ??= document.createElement('canvas'));
  const out = (scratch.out ??= document.createElement('canvas'));
  src.width = w; src.height = h; out.width = w; out.height = h; // зміна розміру ще й очищає
  drawFrameImage(src.getContext('2d')!, rf, fitDefault, progress, assets, size, frameT, noMotion);
  renderAscii(src, out, ascii, frameT, progress);
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
  if (tr.rotY || tr.rotX) {
    // Псевдо-3D: малюємо плоский кадр окремо й проєктуємо його смужками (спершу вісь Y, потім X)
    const w = Math.max(1, Math.round(W)), h = Math.max(1, Math.round(H));
    const flat = scratchCanvas('flat', w, h);
    const fctx = flat.getContext('2d')!;
    for (const layer of rf.frame.layers) drawLayer(fctx, layer, layer.fit ?? fitDefault, assets, size, frameT);
    const persp = tr.persp ?? 0.3;
    if (tr.rotY && tr.rotX) {
      const mid = scratchCanvas('flat2', w, h);
      projectAxis(mid.getContext('2d')!, flat, w, h, tr.rotY, persp, 'y');
      projectAxis(ctx, mid, w, h, tr.rotX, persp, 'x');
    } else projectAxis(ctx, flat, w, h, tr.rotY || tr.rotX || 0, persp, tr.rotY ? 'y' : 'x');
  } else {
    for (const layer of rf.frame.layers) drawLayer(ctx, layer, layer.fit ?? fitDefault, assets, size, frameT);
  }
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
  const tl = buildTimeline(project);
  const { items, total } = tl;
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

  const wrapD = loopBackDuration(project, tl);
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
  } else if (wrapD > 0 && time > total - wrapD) {
    // Зациклення: наприкінці останній кадр переходить у перший тим самим ефектом
    const last = items[items.length - 1], first = items[0];
    const tr = last.rf.transitionOut;
    transitions[tr.type](
      ctx,
      applyEasing(tr.easing, (time - (total - wrapD)) / wrapD),
      () => drawFrame(ctx, last.rf, fitDefault, progressOf(last), assets, size, Math.max(0, time - last.start), noMotion),
      () => drawFrame(ctx, first.rf, fitDefault, 0, assets, size, 0, noMotion),
      size,
    );
  } else {
    drawFrame(ctx, cur.rf, fitDefault, progressOf(cur), assets, size, Math.max(0, time - cur.start), noMotion);
  }
  ctx.restore();
  drawOverlay();
}
