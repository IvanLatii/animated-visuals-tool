import type { ExportJob, Project } from '../model/types';
import { projectDuration, type Assets } from '../render/renderScene';
import { encodeGifski } from './gifskiClient';
import { exportSize, frameCount, renderFrames } from './renderFrames';

/** MP4: розмір ≈ бітрейт × тривалість. Реальний файл зазвичай трохи менший (статичні місця стискаються краще). */
export function estimateMp4(project: Project, job: ExportJob): number {
  return ((job.mp4?.bitrate ?? 4e6) * projectDuration(project)) / 8;
}

/**
 * GIF точно порахувати наперед неможливо. Беремо два місця анімації (30% і 70% часу) і в кожному кодуємо
 * шматок із 2 і з 8 кадрів: різниця дає ціну одного звичайного кадру, а решта — ціну першого (він дорожчий).
 * Підсумок = перший кадр + звичайний кадр × (кадрів − 1). Це все одно оцінка, а не точне число.
 */
export async function estimateGif(project: Project, job: ExportJob, assets: Assets, signal?: AbortSignal): Promise<number> {
  const n = frameCount(project, job.fps);
  const size = exportSize(project, job.scale);
  const quality = job.gif?.quality ?? 90;
  const encode = async (from: number, len: number) => {
    const idx = Array.from({ length: len }, (_, i) => from + i);
    const data = await renderFrames(project, assets, size, job.fps, idx, signal);
    return (await encodeGifski(data, size.w, size.h, job.fps, quality, signal)).size;
  };
  if (n <= 8) return encode(0, n); // коротке — рахуємо повністю, це і є точний розмір

  let first = 0, per = 0, k = 0;
  for (const f of [0.3, 0.7]) {
    const from = Math.min(n - 8, Math.floor(n * f));
    const [small, big] = [await encode(from, 2), await encode(from, 8)];
    const marginal = Math.max(0, (big - small) / 6);
    per += marginal; first += Math.max(0, small - 2 * marginal); k++;
  }
  return (first / k + (per / k) * (n - 1)) * 1.15; // запас: на тесті оцінка була ~20% нижча за реальний розмір
}

export async function estimateBytes(project: Project, job: ExportJob, assets: Assets, signal?: AbortSignal): Promise<number> {
  return job.format === 'mp4' ? estimateMp4(project, job) : estimateGif(project, job, assets, signal);
}
