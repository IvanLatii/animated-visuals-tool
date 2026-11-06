import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality } from 'mediabunny';
import type { ExportJob, Project } from '../model/types';
import { prepareClips, renderScene, type Assets } from '../render/renderScene';
import type { ExportOptions } from './exportGif';
import { exportSize, frameCount, throwIfAborted } from './renderFrames';

export async function exportMp4(project: Project, job: ExportJob, assets: Assets, opts: ExportOptions = {}): Promise<Blob> {
  const { signal, onStatus } = opts;
  const size = exportSize(project, job.scale);
  const canvas = document.createElement('canvas');
  canvas.width = size.w; canvas.height = size.h;

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec: 'avc', quality: new Quality({ bitrate: Math.max(1000, Math.round(job.mp4?.bitrate ?? 4e6)) }) });
  output.addVideoTrack(source, { frameRate: job.fps });
  await output.start();

  const n = frameCount(project, job.fps);
  try {
    for (let f = 0; f < n; f++) {
      throwIfAborted(signal);
      await prepareClips(project, f / job.fps, assets);
      renderScene(project, f / job.fps, canvas, assets);
      await source.add(f / job.fps, 1 / job.fps);
      onStatus?.('Encoding MP4', (f + 1) / n);
    }
    source.close();
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => undefined);
    throw e;
  }
  return new Blob([output.target.buffer!], { type: 'video/mp4' });
}
