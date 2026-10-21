import type { ExportJob, Project } from '../model/types';
import type { Assets } from '../render/renderScene';
import { encodeGifski } from './gifskiClient';
import { exportSize, frameCount, renderFrames, throwIfAborted } from './renderFrames';

// gifski-wasm тримає всі кадри в пам'яті одразу, тож зверху ставимо запобіжник.
const MAX_FRAME_BYTES = 1.5e9;

export interface ExportOptions {
  signal?: AbortSignal;
  onStatus?: (text: string, progress: number | null) => void;
}

export function gifMemoryBytes(project: Project, job: ExportJob): number {
  const { w, h } = exportSize(project, job.scale);
  return frameCount(project, job.fps) * w * h * 4;
}

export async function exportGif(project: Project, job: ExportJob, assets: Assets, opts: ExportOptions = {}): Promise<Blob> {
  const { signal, onStatus } = opts;
  if (gifMemoryBytes(project, job) > MAX_FRAME_BYTES) {
    throw new Error('Забагато кадрів для GIF у такому розмірі. Зменш FPS або розмір, або обери MP4.');
  }
  const size = exportSize(project, job.scale);
  const n = frameCount(project, job.fps);
  const indices = Array.from({ length: n }, (_, i) => i);
  onStatus?.('Малюю кадри', 0);
  const frames = await renderFrames(project, assets, size, job.fps, indices, signal, (p) => onStatus?.('Малюю кадри', p));
  throwIfAborted(signal);
  onStatus?.('Кодую GIF (це найдовший крок)', null);
  return encodeGifski(frames, size.w, size.h, job.fps, job.gif?.quality ?? 90, signal);
}
