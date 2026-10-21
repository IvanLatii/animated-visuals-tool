import GIF from 'gif.js';
import workerUrl from 'gif.js/dist/gif.worker.js?url';
import type { ExportJob, Project } from '../model/types';
import { projectDuration, renderScene, type Assets } from '../render/renderScene';

export function exportGif(project: Project, job: ExportJob, assets: Assets, onProgress?: (p: number) => void): Promise<Blob> {
  const { w, h } = project.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const opts = job.gif ?? { dither: false as const, quality: 10 };

  return new Promise((resolve, reject) => {
    const gif = new GIF({ workers: 4, quality: opts.quality, width: w, height: h, workerScript: workerUrl, dither: opts.dither });
    const frames = Math.max(1, Math.round(projectDuration(project) * job.fps));
    for (let f = 0; f < frames; f++) {
      renderScene(project, f / job.fps, canvas, assets);
      gif.addFrame(canvas, { copy: true, delay: Math.round(1000 / job.fps) });
    }
    gif.on('progress', (p: number) => onProgress?.(p));
    gif.on('finished', (blob: Blob) => resolve(blob));
    gif.on('abort', () => reject(new Error('Експорт GIF перервано')));
    gif.render();
  });
}
