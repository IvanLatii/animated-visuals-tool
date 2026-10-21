import type { ExportJob, Project } from '../model/types';
import type { Assets } from '../render/renderScene';
import { projectDuration } from '../render/renderScene';
import { estimateGif } from './estimate';
import { exportGif, gifMemoryBytes, type ExportOptions } from './exportGif';
import { exportMp4 } from './exportMp4';
import { GIF_MIN_QUALITY } from './presets';
import { exportSize, throwIfAborted } from './renderFrames';

export interface FitResult { job: ExportJob; blob: Blob; fits: boolean }

const SAFETY = 0.95; // цілимось трохи нижче ліміту

/**
 * Драбина для GIF: від найменшої втрати до найбільшої.
 * Спершу якість кольору (не нижче 80), потім FPS, потім розмір картинки. Нижче 50% розміру не йдемо.
 */
function gifLadder(base: ExportJob, allowScale: boolean): ExportJob[] {
  const steps: ExportJob[] = [];
  const q0 = base.gif?.quality ?? 90;
  const add = (quality: number, fps: number, scale: number) => {
    if (quality > q0 || fps > base.fps || scale > base.scale) return;
    steps.push({ format: 'gif', fps, scale, gif: { quality } });
  };
  add(q0, base.fps, base.scale);
  for (const q of [90, 85, GIF_MIN_QUALITY]) add(q, base.fps, base.scale);
  const q = Math.min(q0, GIF_MIN_QUALITY);
  for (const f of [30, 24, 20]) add(q, f, base.scale);
  const fps20 = Math.min(base.fps, 20);
  if (allowScale) for (const sc of [0.9, 0.8, 0.7]) add(q, fps20, Math.min(base.scale, sc));
  const fps15 = Math.min(base.fps, 15);
  add(q, fps15, steps[steps.length - 1]?.scale ?? base.scale);
  if (allowScale) for (const sc of [0.6, 0.5]) add(q, fps15, Math.min(base.scale, sc));
  add(q, 12, steps[steps.length - 1]?.scale ?? base.scale);
  // прибираємо дублі
  return steps.filter((s, i) => steps.findIndex((o) => o.fps === s.fps && o.scale === s.scale && o.gif?.quality === s.gif?.quality) === i);
}

export async function fitMp4(project: Project, base: ExportJob, targetBytes: number, assets: Assets, allowScale: boolean, opts: ExportOptions): Promise<FitResult> {
  const dur = projectDuration(project);
  let job: ExportJob = { ...base, mp4: { bitrate: base.mp4?.bitrate ?? 4e6 } };
  const MIN_BPP = 0.03; // нижче цього відео виглядає як «мило»
  const fpsSteps = [60, 30, 24].filter((f) => f <= base.fps);
  const scaleSteps = allowScale ? [1, 0.9, 0.8, 0.7, 0.6, 0.5].filter((s) => s <= base.scale) : [base.scale];
  // Шукаємо першу комбінацію, де потрібний бітрейт ще не нижче порогу якості.
  const needed = (fps: number, scale: number) => {
    const { w, h } = exportSize(project, scale);
    const bitrate = (targetBytes * SAFETY * 8) / dur;
    return { bitrate: Math.min(bitrate, job.mp4!.bitrate), ok: bitrate >= w * h * fps * MIN_BPP };
  };
  let chosen: { fps: number; scale: number; bitrate: number } | null = null;
  outer: for (const scale of scaleSteps) for (const fps of fpsSteps) {
    const n = needed(fps, Math.min(scale, base.scale));
    if (n.ok) { chosen = { fps, scale: Math.min(scale, base.scale), bitrate: n.bitrate }; break outer; }
  }
  const last = { fps: fpsSteps[fpsSteps.length - 1] ?? base.fps, scale: scaleSteps[scaleSteps.length - 1] ?? base.scale };
  const pick = chosen ?? { ...last, bitrate: (targetBytes * SAFETY * 8) / dur };
  job = { format: 'mp4', fps: pick.fps, scale: pick.scale, mp4: { bitrate: pick.bitrate } };

  let blob: Blob = new Blob();
  for (let attempt = 0; attempt < 4; attempt++) {
    throwIfAborted(opts.signal);
    blob = await exportMp4(project, job, assets, { ...opts, onStatus: (t, p) => opts.onStatus?.(`Attempt ${attempt + 1}: ${t}`, p) });
    if (blob.size <= targetBytes) return { job, blob, fits: true };
    job = { ...job, mp4: { bitrate: job.mp4!.bitrate * Math.max(0.5, (targetBytes * SAFETY) / blob.size) } };
  }
  return { job, blob, fits: blob.size <= targetBytes };
}

export async function fitGif(project: Project, base: ExportJob, targetBytes: number, assets: Assets, allowScale: boolean, opts: ExportOptions): Promise<FitResult> {
  const ladder = gifLadder(base, allowScale).filter((j) => gifMemoryBytes(project, j) <= 1.5e9);
  if (ladder.length === 0) throw new Error('Too many frames for GIF even at the lowest settings. Make the animation shorter or use MP4.');

  // Бінарний пошук першого кроку драбини, оцінений розмір якого вміщується (розмір падає вздовж драбини).
  let lo = 0, hi = ladder.length - 1, found = ladder.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    throwIfAborted(opts.signal);
    opts.onStatus?.(`Trying ${ladder[mid].fps} fps, ${Math.round(ladder[mid].scale * 100)}%, quality ${ladder[mid].gif?.quality}`, null);
    const est = await estimateGif(project, ladder[mid], assets, opts.signal);
    if (est <= targetBytes * SAFETY) { found = mid; hi = mid - 1; } else lo = mid + 1;
  }

  let blob: Blob = new Blob();
  for (let i = found; i < ladder.length && i < found + 4; i++) {
    throwIfAborted(opts.signal);
    const label = `Export ${ladder[i].fps} fps, ${Math.round(ladder[i].scale * 100)}%, quality ${ladder[i].gif?.quality}`;
    blob = await exportGif(project, ladder[i], assets, { ...opts, onStatus: (t, p) => opts.onStatus?.(`${label}: ${t}`, p) });
    if (blob.size <= targetBytes) return { job: ladder[i], blob, fits: true };
    if (i === found + 3 || i === ladder.length - 1) return { job: ladder[i], blob, fits: false };
  }
  return { job: ladder[ladder.length - 1], blob, fits: false };
}

export function fitToSize(project: Project, base: ExportJob, targetBytes: number, assets: Assets, allowScale: boolean, opts: ExportOptions): Promise<FitResult> {
  return base.format === 'mp4'
    ? fitMp4(project, base, targetBytes, assets, allowScale, opts)
    : fitGif(project, base, targetBytes, assets, allowScale, opts);
}
