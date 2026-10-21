import type { Project } from '../model/types';
import { projectDuration, renderScene, type Assets } from '../render/renderScene';

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2); // H.264 і GIF-кодувальник люблять парні розміри

export function exportSize(project: Project, scale: number) {
  return { w: even(project.canvas.w * scale), h: even(project.canvas.h * scale) };
}

export function frameCount(project: Project, fps: number): number {
  return Math.max(1, Math.round(projectDuration(project) * fps));
}

export class ExportAborted extends Error {
  constructor() { super('Експорт скасовано'); this.name = 'ExportAborted'; }
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
    renderScene(project, indices[k] / fps, canvas, assets);
    out.push(ctx.getImageData(0, 0, size.w, size.h));
    onProgress?.((k + 1) / indices.length);
    if (k % 6 === 5) await tick();
  }
  return out;
}
