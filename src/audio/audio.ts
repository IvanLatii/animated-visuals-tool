import type { PlanItem } from './plan';

// Звук: декодування файлів, хвиля, відтворення (WebAudio) і офлайн-мікс для експорту MP4.

let ctx: AudioContext | null = null;
export function audioCtx(): AudioContext {
  return (ctx ??= new AudioContext());
}

const buffers = new Map<string, Promise<AudioBuffer | null>>();

/** Декодований звук за src (data/blob URL). null — у файлі нема звуку (наприклад, відео без звукової доріжки). */
export function getBuffer(src: string): Promise<AudioBuffer | null> {
  let p = buffers.get(src);
  if (!p) {
    p = fetch(src).then((r) => r.arrayBuffer()).then((ab) => audioCtx().decodeAudioData(ab)).catch(() => null);
    buffers.set(src, p);
  }
  return p;
}

/** Читає файл звуку: повертає data URL і довжину; кидає помилку, якщо браузер не вміє його декодувати. */
export async function readAudio(file: File): Promise<{ src: string; duration: number }> {
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error('Could not read the file'));
    r.readAsDataURL(file);
  });
  const buf = await getBuffer(src);
  if (!buf) { buffers.delete(src); throw new Error('This audio format cannot be decoded by the browser'); }
  return { src, duration: buf.duration };
}

const peakCache = new WeakMap<AudioBuffer, Float32Array>();
const PEAKS = 2000;
/** Піки гучності (0–1) по всій довжині: для малювання хвилі. */
export function peaksOf(buf: AudioBuffer): Float32Array {
  let p = peakCache.get(buf);
  if (p) return p;
  p = new Float32Array(PEAKS);
  const per = Math.max(1, Math.floor(buf.length / PEAKS));
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < PEAKS; i++) {
      let m = 0;
      const from = i * per, to = Math.min(d.length, from + per);
      for (let j = from; j < to; j += Math.max(1, Math.floor(per / 64))) m = Math.max(m, Math.abs(d[j]));
      p[i] = Math.max(p[i], m);
    }
  }
  peakCache.set(buf, p);
  return p;
}

/** Гучність фрагмента в момент τ сцени: обвідна з fade in / fade out. */
function envelope(it: PlanItem, tau: number): number {
  let g = it.volume;
  if (it.fadeIn > 0) g *= Math.min(1, Math.max(0, (tau - it.start) / it.fadeIn));
  if (it.fadeOut > 0) g *= Math.min(1, Math.max(0, (it.until - tau) / it.fadeOut));
  return g;
}

/** Розкладає фрагменти по контексту. t0 — момент сцени, з якого грати; now — час контексту, що відповідає t0. */
function schedule(c: BaseAudioContext, dest: AudioNode, plan: PlanItem[], bufs: (AudioBuffer | null)[], t0: number, now: number): AudioScheduledSourceNode[] {
  const nodes: AudioScheduledSourceNode[] = [];
  plan.forEach((it, k) => {
    const buf = bufs[k];
    if (!buf || t0 >= it.until) return;
    const L = Math.max(0.01, it.outPt - it.inPt);
    const from = Math.max(t0, it.start); // з якого моменту сцени звук реально йде
    const when = now + (from - t0);
    const elapsed = (from - it.start) * it.speed;
    if (!it.loop && elapsed >= L) return;
    const offset = it.loop ? it.inPt + (elapsed % L) : it.inPt + elapsed;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = it.speed;
    if (it.loop) { src.loop = true; src.loopStart = it.inPt; src.loopEnd = it.outPt; }
    const g = c.createGain();
    // обвідна: опорні точки в моменти сцени, між ними лінійно
    const pts = [from, it.start + it.fadeIn, it.until - it.fadeOut, it.until].filter((x) => x >= from && x <= it.until);
    g.gain.setValueAtTime(envelope(it, from), when);
    for (const x of [...new Set(pts)].sort((a, b) => a - b)) g.gain.linearRampToValueAtTime(envelope(it, x), now + (x - t0));
    src.connect(g).connect(dest);
    if (it.loop) src.start(when, offset); else src.start(when, offset, Math.max(0.001, it.outPt - offset));
    src.stop(now + (it.until - t0));
    nodes.push(src);
  });
  return nodes;
}

/** Відтворення в реальному часі: play(план, момент сцени) знову розкладає всі фрагменти, stop() їх гасить. */
class Engine {
  private nodes: AudioScheduledSourceNode[] = [];
  private token = 0;

  async play(plan: PlanItem[], t0: number, onEnd?: () => void): Promise<void> {
    this.stop();
    const my = ++this.token;
    if (plan.length === 0) return;
    const c = audioCtx();
    const bufs = await Promise.all(plan.map((it) => getBuffer(it.src)));
    if (my !== this.token) return; // за час декодування вже зупинили або перемотали
    if (c.state !== 'running') await c.resume().catch(() => undefined);
    this.nodes = schedule(c, c.destination, plan, bufs, t0, c.currentTime + 0.02);
    const last = this.nodes[this.nodes.length - 1];
    if (last && onEnd) last.onended = () => { if (my === this.token) onEnd(); };
  }

  stop(): void {
    this.token++;
    for (const n of this.nodes) { n.onended = null; try { n.stop(); } catch { /* вже зупинено */ } n.disconnect(); }
    this.nodes = [];
  }
}
export const engine = new Engine();
/** Окреме прослуховування однієї доріжки: з її початку, без сцени. */
export const soloEngine = new Engine();

/** Змішує всі фрагменти в один стерео-буфер на всю довжину сцени. null — нічого не звучить. */
export async function renderMix(plan: PlanItem[], total: number, sampleRate = 48000): Promise<AudioBuffer | null> {
  if (plan.length === 0 || total <= 0) return null;
  const bufs = await Promise.all(plan.map((it) => getBuffer(it.src)));
  if (bufs.every((b) => !b)) return null;
  const off = new OfflineAudioContext(2, Math.max(1, Math.ceil(total * sampleRate)), sampleRate);
  schedule(off, off.destination, plan, bufs, 0, 0);
  return off.startRendering();
}
