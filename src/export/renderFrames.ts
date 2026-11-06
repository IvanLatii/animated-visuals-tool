import type { Project } from '../model/types';
import { prepareClips, projectDuration, renderScene, type Assets } from '../render/renderScene';

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2); // H.264 і GIF-кодувальник люблять парні розміри

/** H.264 у браузерах кодує не більше приблизно 4K; більші розміри (наприклад 3240×3240) кодувальник відхиляє. */
export const MP4_MAX_PIXELS = 3840 * 2160;
export const MP4_MAX_SIDE = 4096;

/** Розмір файлу експорту. Для MP4 (format = 'mp4') зменшується до межі кодувальника, пропорції зберігаються. */
export function exportSize(project: Project, scale: number, format?: 'mp4' | 'gif' | 'png') {
  let w = project.canvas.w * scale, h = project.canvas.h * scale;
  if (format === 'mp4') {
    const k = Math.min(1, Math.sqrt(MP4_MAX_PIXELS / (w * h)), MP4_MAX_SIDE / Math.max(w, h));
    w *= k; h *= k;
  }
  return { w: even(w), h: even(h) };
}

/** Чи MP4 при цьому масштабі доведеться зменшити проти налаштованого розміру. */
export function mp4IsCapped(project: Project, scale: number): boolean {
  const a = exportSize(project, scale), b = exportSize(project, scale, 'mp4');
  return a.w !== b.w || a.h !== b.h;
}

export function frameCount(project: Project, fps: number): number {
  return Math.max(1, Math.round(projectDuration(project) * fps));
}

export class ExportAborted extends Error {
  constructor() { super('Export cancelled'); this.name = 'ExportAborted'; }
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new ExportAborted();
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/** Малює кадри з номерами indices у піксельні дані. Іноді віддає керування, щоб інтерфейс не завмирав. */
export async function renderFrames(
  project: Project, assets: Assets, size: { w: number; h: number }, fps: number, indices: number[],
  signal?: AbortSignal, onProgress?: (p: number) => void,
): Promise<ImageData[]> {
  const canvas = document.createElement('canvas');
  canvas.width = size.w; canvas.height = size.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const out: ImageData[] = [];
  for (let k = 0; k < indices.length; k++) {
    throwIfAborted(signal);
    await prepareClips(project, indices[k] / fps, assets);
    renderScene(project, indices[k] / fps, canvas, assets);
    out.push(ctx.getImageData(0, 0, size.w, size.h));
    onProgress?.((k + 1) / indices.length);
    if (k % 6 === 5) await tick();
  }
  return out;
}
