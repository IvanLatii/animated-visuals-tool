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

const GRID = 60; // кадри кешуємо на сітці 60 за секунду: вистачає для експорту до 60 FPS
const CACHE_FRAMES = 60;
const MAX_QUEUE = 8;
const DECODE_LONG_SIDE = 1600; // більше за це декодувати немає сенсу: полотно зазвичай ≤ 1920

class VideoClip implements ClipAsset {
  readonly isClip = true as const;
  private cache = new Map<number, CanvasImageSource>();
  private queue: number[] = [];
  private waiters = new Map<number, { promise: Promise<void>; resolve: () => void }>();
  private running = false;
  private last: CanvasImageSource;

  constructor(private sink: CanvasSink, private first: number, readonly width: number, readonly height: number, readonly duration: number, poster: CanvasImageSource) {
    this.last = poster;
  }

  private key = (t: number) => Math.max(0, Math.round(t * GRID));

  peek(t: number): CanvasImageSource {
    const k = this.key(t);
    const hit = this.cache.get(k);
    if (hit) {
      this.cache.delete(k); this.cache.set(k, hit); // свіжий у кеші
      this.last = hit;
      return hit;
    }
    void this.request(k);
    for (let i = 1; i <= 4; i++) { const near = this.cache.get(k - i); if (near) return near; }
    return this.last;
  }

  ensure(t: number): Promise<void> {
    return this.request(this.key(t));
  }

  private request(k: number): Promise<void> {
    if (this.cache.has(k)) return Promise.resolve();
    const w = this.waiters.get(k);
    if (w) return w.promise;
    let resolve!: () => void;
    const promise = new Promise<void>((r) => { resolve = r; });
    this.waiters.set(k, { promise, resolve });
    this.queue.push(k);
    while (this.queue.length > MAX_QUEUE) { // під час гортання старі запити вже не потрібні
      const old = this.queue.shift()!;
      this.waiters.get(old)?.resolve();
      this.waiters.delete(old);
    }
    void this.run();
    return promise;
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length) {
      const k = this.queue.pop()!; // найновіший запит першим: саме його зараз видно
      try {
        const w = await this.sink.getCanvas(this.first + k / GRID);
        if (w) this.cache.set(k, w.canvas);
      } catch { /* кадр не декодувався: лишається попередній */ }
      while (this.cache.size > CACHE_FRAMES) this.cache.delete(this.cache.keys().next().value!);
      this.waiters.get(k)?.resolve();
      this.waiters.delete(k);
      notify();
    }
    this.running = false;
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
  let t = 0, width = 0, height = 0;
  for (let i = 0; i < count; i++) {
    const { image } = await dec.decode({ frameIndex: i });
    let d = (image.duration ?? 0) / 1e6;
    if (d < 0.02) d = 0.1; // так само роблять браузери для «нульових» затримок
    width = image.displayWidth; height = image.displayHeight;
    if (i === 0 && width * height * count * 4 > 800e6) { image.close(); dec.close(); throw new Error('This GIF is too large to open (too many frames at this size)'); }
    frames.push({ bitmap: await createImageBitmap(image), start: t });
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
