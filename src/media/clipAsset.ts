import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny';

/**
 * Відео або GIF як джерело кадрів. Малювання синхронне (peek віддає вже готовий кадр), а декодування асинхронне:
 *  - прев'ю: peek запускає декодування й одразу віддає найближчий готовий кадр; коли новий готовий, сповіщаємо (onClipFrame);
 *  - експорт: перед малюванням кадру await ensure(t), тоді peek гарантовано віддає точний кадр.
 * Звук поки не читаємо (рішення: без звуку; місце для нього — тут, поруч із відео-доріжкою).
 */
export interface ClipAsset {
  readonly isClip: true;
  readonly width: number;
  readonly height: number;
  /** Повна довжина джерела, секунди. */
  readonly duration: number;
  peek(t: number): CanvasImageSource;
  ensure(t: number): Promise<void>;
}

export const isClip = (a: unknown): a is ClipAsset => typeof a === 'object' && a !== null && (a as ClipAsset).isClip === true;

const listeners = new Set<() => void>();
/** Підписка на «з'явився новий декодований кадр»: прев'ю перемальовується. Повертає функцію відписки. */
export function onClipFrame(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
const notify = () => listeners.forEach((cb) => cb());

const MAX_FRAMES = 40; // скільки декодованих кадрів тримаємо (на 1600 px це ~230 МБ)
const AHEAD = 0.4; // скільки секунд наперед декодуємо під час програвання
const GAP = 1.0; // далі за стільки секунд від поточного місця декодер перескакує (seek), а не доганяє
const GIF_MEMORY_BUDGET = 500e6; // байт на всі кадри одного GIF
const DECODE_LONG_SIDE = 1600; // більше за це декодувати немає сенсу: полотно зазвичай ≤ 1920

interface Decoded { ts: number; end: number; canvas: CanvasImageSource }

/**
 * Відео: кадри декодуються ПОСЛІДОВНО з випередженням (як у плеєрах), а не окремим запитом на кожен кадр.
 * Єдиний цикл (pump) володіє декодером: тримає попереду цілі ~AHEAD секунд кадрів, а при стрибку (перемотування) починає з нового місця.
 */
class VideoClip implements ClipAsset {
  readonly isClip = true as const;
  private frames: Decoded[] = []; // за зростанням ts
  private want = 0; // момент (у часі файлу), який зараз потрібен
  private missing = false; // peek не знайшов кадр і показав запасний
  private iter: AsyncGenerator<{ canvas: CanvasImageSource; timestamp: number; duration: number }, void, unknown> | null = null;
  private iterEnd = -1; // де закінчився останній кадр, виданий ітератором
  private eof = false;
  private running = false;
  private waiters: { tt: number; resolve: () => void }[] = [];
  private last: CanvasImageSource;

  constructor(private sink: CanvasSink, private first: number, readonly width: number, readonly height: number, readonly duration: number, poster: CanvasImageSource) {
    this.last = poster;
  }

  /** Індекс кадру, що показується в момент tt (останній, що почався), або -1. */
  private find(tt: number): number {
    let lo = 0, hi = this.frames.length - 1, at = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.frames[mid].ts <= tt + 1e-6) { at = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return at;
  }

  private covered(tt: number): boolean {
    if (this.eof && tt >= this.first + this.duration - 1e-3) return true; // кінець файлу: тримаємо останній кадр
    const i = this.find(tt);
    return i >= 0 && tt < this.frames[i].end - 1e-6;
  }

  private needsWork(): boolean {
    if (!this.covered(this.want)) return true;
    if (this.eof) return false;
    const i = this.find(this.want + AHEAD);
    return !(i >= 0 && this.want + AHEAD < this.frames[i].end - 1e-6);
  }

  peek(t: number): CanvasImageSource {
    const tt = this.first + t;
    this.want = tt;
    const i = this.find(tt);
    const hit = i >= 0 && (tt < this.frames[i].end - 1e-6 || this.eof);
    if (this.needsWork()) void this.pump();
    if (hit) { this.last = this.frames[i].canvas; this.missing = false; return this.last; }
    this.missing = true;
    return i >= 0 ? this.frames[i].canvas : this.last; // найближчий попередній кадр, поки новий декодується
  }

  ensure(t: number): Promise<void> {
    const tt = this.first + t;
    this.want = tt;
    if (this.covered(tt)) { if (this.needsWork()) void this.pump(); return Promise.resolve(); }
    return new Promise<void>((resolve) => { this.waiters.push({ tt, resolve }); void this.pump(); });
  }

  private flushWaiters() {
    this.waiters = this.waiters.filter((w) => { if (this.covered(w.tt)) { w.resolve(); return false; } return true; });
  }

  private insert(d: Decoded) {
    const i = this.find(d.ts);
    if (i >= 0 && Math.abs(this.frames[i].ts - d.ts) < 1e-6) return; // вже є
    this.frames.splice(i + 1, 0, d);
    while (this.frames.length > MAX_FRAMES) { // прибираємо найдальші від потрібного моменту
      let far = 0, farD = -1;
      for (let k = 0; k < this.frames.length; k++) { const dist = Math.abs(this.frames[k].ts - this.want); if (dist > farD) { farD = dist; far = k; } }
      this.frames.splice(far, 1);
    }
  }

  /** Перескок: беремо точний кадр на момент from, далі ітератор іде послідовно від наступного. */
  private async restart(from: number) {
    const old = this.iter;
    this.iter = null; this.eof = false; this.iterEnd = -1;
    if (old) await old.return(undefined).catch(() => undefined);
    const w0 = await this.sink.getCanvas(Math.max(this.first, from)).catch(() => null);
    let next = Math.max(this.first, from);
    if (w0) {
      this.insert({ ts: w0.timestamp, end: w0.timestamp + Math.max(w0.duration, 1e-3), canvas: w0.canvas });
      this.iterEnd = w0.timestamp + w0.duration;
      next = this.iterEnd - 1e-4; // трохи раніше початку наступного кадру; повтор поточного відсіє insert
      this.flushWaiters();
    }
    this.iter = this.sink.canvases(next);
  }

  private async pump() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.needsWork()) {
        const want = this.want;
        const lost = !this.iter || want < (this.frames[0]?.ts ?? Infinity) && !this.covered(want) || (this.iterEnd >= 0 && want > this.iterEnd + GAP);
        if (lost) await this.restart(want);
        let item: IteratorResult<{ canvas: CanvasImageSource; timestamp: number; duration: number }, void>;
        try { item = await this.iter!.next(); } catch { this.iter = null; this.eof = true; break; }
        if (item.done) { this.iter = null; this.eof = true; break; }
        const w = item.value;
        this.insert({ ts: w.timestamp, end: w.timestamp + Math.max(w.duration, 1e-3), canvas: w.canvas });
        this.iterEnd = w.timestamp + w.duration;
        this.flushWaiters();
        if (this.missing && this.covered(this.want)) { this.missing = false; notify(); } // кадр, якого бракувало, з'явився: перемалювати
      }
    } finally {
      this.running = false;
      this.flushWaiters();
      if (this.waiters.length > 0 || this.needsWork()) { if (!this.eof) void this.pump(); else this.flushWaiters(); }
      if (this.eof) { this.waiters.forEach((w) => w.resolve()); this.waiters = []; }
    }
  }
}

interface GifFrame { bitmap: ImageBitmap; start: number }

class GifClip implements ClipAsset {
  readonly isClip = true as const;
  constructor(private frames: GifFrame[], readonly width: number, readonly height: number, readonly duration: number) {}

  peek(t: number): CanvasImageSource {
    let lo = 0, hi = this.frames.length - 1;
    while (lo < hi) { // останній кадр, що почався не пізніше t
      const mid = (lo + hi + 1) >> 1;
      if (this.frames[mid].start <= t) lo = mid; else hi = mid - 1;
    }
    return this.frames[lo].bitmap;
  }

  ensure(): Promise<void> { return Promise.resolve(); } // усі кадри вже в пам'яті
}

export interface OpenedClip {
  asset: ClipAsset;
  kind: 'video' | 'gif';
  duration: number;
  /** Мініатюра першого кадру, data URL. */
  poster: string;
}

function posterOf(source: CanvasImageSource, w: number, h: number): string {
  const k = Math.min(1, 240 / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d')!.drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75);
}

async function openVideo(blob: Blob): Promise<OpenedClip> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error('The file has no video track');
  if (!(await track.canDecode())) throw new Error('This video format is not supported by the browser. Try MP4 (H.264) or WebM');
  const [duration, first] = await Promise.all([input.computeDuration(), input.getFirstTimestamp()]);
  const k = Math.min(1, DECODE_LONG_SIDE / Math.max(track.displayWidth, track.displayHeight));
  const width = Math.max(2, Math.round(track.displayWidth * k));
  const sink = new CanvasSink(track, { width });
  const firstFrame = await sink.getCanvas(first);
  if (!firstFrame) throw new Error('Could not read the first frame');
  const height = firstFrame.canvas.height;
  return {
    asset: new VideoClip(sink, first, firstFrame.canvas.width, height, duration, firstFrame.canvas),
    kind: 'video', duration, poster: posterOf(firstFrame.canvas, firstFrame.canvas.width, height),
  };
}

/** Анімований GIF. Статичний (один кадр) повертає null: його беремо як звичайну картинку. */
async function openGif(blob: Blob): Promise<OpenedClip | null> {
  if (typeof ImageDecoder === 'undefined') throw new Error('Animated GIF needs a Chromium browser (Chrome, Edge)');
  const dec = new ImageDecoder({ data: await blob.arrayBuffer(), type: 'image/gif' });
  await dec.tracks.ready;
  const count = dec.tracks.selectedTrack?.frameCount ?? 1;
  if (count <= 1) { dec.close(); return null; }
  const frames: GifFrame[] = [];
  let t = 0, width = 0, height = 0, k = 1;
  for (let i = 0; i < count; i++) {
    const { image } = await dec.decode({ frameIndex: i });
    let d = (image.duration ?? 0) / 1e6;
    if (d < 0.02) d = 0.1; // так само роблять браузери для «нульових» затримок
    if (i === 0) {
      // Усі кадри лежать у пам'яті. Дуже важкий GIF зменшуємо, щоб вкластись у бюджет, замість відмови.
      k = Math.min(1, Math.sqrt(GIF_MEMORY_BUDGET / (image.displayWidth * image.displayHeight * count * 4)));
      if (k < 0.2) { image.close(); dec.close(); throw new Error('This GIF is too large to open (too many frames at this size). Convert it to MP4 first'); }
      width = Math.max(2, Math.round(image.displayWidth * k)); height = Math.max(2, Math.round(image.displayHeight * k));
    }
    frames.push({ bitmap: k < 1 ? await createImageBitmap(image, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' }) : await createImageBitmap(image), start: t });
    t += d;
    image.close();
  }
  dec.close();
  return { asset: new GifClip(frames, width, height, t), kind: 'gif', duration: t, poster: posterOf(frames[0].bitmap, width, height) };
}

/** Відкриває файл як відео чи GIF. null — це не кліп (статична картинка). */
export async function openClip(file: Blob, mime: string): Promise<OpenedClip | null> {
  if (mime.startsWith('video/')) return openVideo(file);
  if (mime === 'image/gif') return openGif(file);
  return null;
}

/** Відновлення кліпу зі збереженого проєкту (src — data URL файлу). */
export async function restoreClip(src: string, kind: 'video' | 'gif'): Promise<ClipAsset> {
  const blob = await (await fetch(src)).blob();
  const opened = kind === 'video' ? await openVideo(blob) : await openGif(blob);
  if (!opened) throw new Error('The GIF has no animation');
  return opened.asset;
}
