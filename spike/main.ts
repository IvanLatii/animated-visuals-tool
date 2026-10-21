import GIF from 'gif.js';
import workerUrl from 'gif.js/dist/gif.worker.js?url';
import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, Quality } from 'mediabunny';

const W = 1080, H = 1080, FPS = 24;
const HOLD = 1.0, FADE = 0.3; // секунд на кадр / на crossfade (кадри накладаються на FADE)
const N = 3;
const DURATION = N * HOLD;

const log = (s: string) => { document.getElementById('log')!.textContent += '\n' + s; };

// Три тестові "скриншоти" з градієнтами (найгірший випадок для GIF) і дрібним текстом
function makeShot(i: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 1000;
  const g = c.getContext('2d')!;
  const hues = [[250, 320], [160, 210], [20, 60]][i];
  const grad = g.createLinearGradient(0, 0, 1600, 1000);
  grad.addColorStop(0, `hsl(${hues[0]} 70% 55%)`); grad.addColorStop(1, `hsl(${hues[1]} 80% 35%)`);
  g.fillStyle = grad; g.fillRect(0, 0, 1600, 1000);
  g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(120, 120, 1360, 760);
  g.fillStyle = '#222'; g.font = 'bold 72px system-ui'; g.fillText(`Screen ${i + 1}`, 180, 240);
  g.font = '32px system-ui'; g.fillStyle = '#666';
  for (let r = 0; r < 6; r++) g.fillText('Lorem ipsum dolor sit amet, consectetur adipiscing', 180, 330 + r * 60);
  const b = g.createLinearGradient(180, 720, 700, 800);
  b.addColorStop(0, `hsl(${hues[0]} 80% 50%)`); b.addColorStop(1, `hsl(${hues[1]} 80% 60%)`);
  g.fillStyle = b; g.fillRect(180, 720, 520, 90);
  return c;
}
const shots = [0, 1, 2].map(makeShot);

const ease = (x: number) => 1 - Math.pow(1 - x, 2); // ease-out: швидкий старт, без зупинки в кінці

function drawShot(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, p: number, alpha: number) {
  const zoom = 1 + 0.2 * ease(Math.min(1, Math.max(0, p))); // зум in по центру
  const scale = Math.max(W / img.width, H / img.height) * zoom; // fill
  const w = img.width * scale, h = img.height * scale;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  ctx.globalAlpha = 1;
}

// Одна чиста функція: малює сцену в момент t
function renderScene(canvas: HTMLCanvasElement, t: number) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const step = HOLD;
  for (let i = 0; i < N; i++) {
    const start = i * step, end = start + HOLD + (i < N - 1 ? FADE : 0);
    if (t < start || t > end) continue;
    const local = (t - start) / (end - start);
    const fadeIn = i > 0 ? Math.min(1, (t - start) / FADE) : 1;
    drawShot(ctx, shots[i], local, fadeIn);
  }
}

function link(blob: Blob, name: string, el: HTMLElement) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.textContent = `${name} (${(blob.size / 1e6).toFixed(2)} МБ)`;
  el.appendChild(a);
}

async function exportMp4(canvas: HTMLCanvasElement): Promise<Blob> {
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec: 'avc', quality: new Quality({ bitrate: 4e6 }) });
  output.addVideoTrack(source, { frameRate: FPS });
  await output.start();
  const frames = Math.round(DURATION * FPS);
  for (let f = 0; f < frames; f++) { renderScene(canvas, f / FPS); await source.add(f / FPS, 1 / FPS); }
  source.close();
  await output.finalize();
  return new Blob([output.target.buffer!], { type: 'video/mp4' });
}

function exportGif(canvas: HTMLCanvasElement, dither: any): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const gif = new GIF({ workers: 4, quality: 10, width: W, height: H, workerScript: workerUrl, dither });
    const frames = Math.round(DURATION * FPS);
    for (let f = 0; f < frames; f++) {
      renderScene(canvas, f / FPS);
      gif.addFrame(canvas, { copy: true, delay: 1000 / FPS });
    }
    gif.on('finished', (b: Blob) => resolve(b));
    (gif as any).on('abort', () => reject(new Error('gif abort')));
    gif.render();
  });
}

(async () => {
  const out = document.getElementById('out')!;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const result: Record<string, unknown> = { size: `${W}x${H}`, fps: FPS, seconds: DURATION };
  try {
    log(`WebCodecs: ${'VideoEncoder' in window}`);
    let t0 = performance.now();
    const mp4 = await exportMp4(canvas);
    result.mp4 = { bytes: mp4.size, ms: Math.round(performance.now() - t0) };
    log(`MP4 готовий: ${(mp4.size / 1e6).toFixed(2)} МБ, ${result.mp4 && (result.mp4 as any).ms} мс`);
    const v = document.createElement('video'); v.src = URL.createObjectURL(mp4); v.controls = true; v.loop = true; v.muted = true; v.width = 400;
    out.appendChild(v); link(mp4, 'test.mp4', out);
    v.addEventListener('loadedmetadata', () => { result.mp4Playable = { duration: v.duration, w: v.videoWidth, h: v.videoHeight }; });

    for (const d of [false, 'FloydSteinberg', 'Atkinson'] as const) {
      t0 = performance.now();
      const gif = await exportGif(canvas, d);
      const key = `gif_${d || 'none'}`;
      result[key] = { bytes: gif.size, ms: Math.round(performance.now() - t0) };
      log(`GIF (${d || 'без дизерингу'}): ${(gif.size / 1e6).toFixed(2)} МБ, ${(result[key] as any).ms} мс`);
      const img = document.createElement('img'); img.src = URL.createObjectURL(gif); img.width = 400;
      out.appendChild(img); link(gif, `test-${d || 'none'}.gif`, out);
    }
    result.done = true;
  } catch (e) { result.error = String(e); log('ПОМИЛКА: ' + e); }
  (window as any).__result = result;
})();
