import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality } from 'mediabunny';
import type { ExportJob, Project } from '../model/types';
import { projectDuration, renderScene, type Assets } from '../render/renderScene';

export async function exportMp4(project: Project, job: ExportJob, assets: Assets, onProgress?: (p: number) => void): Promise<Blob> {
  const { w, h } = project.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec: 'avc', quality: new Quality({ bitrate: job.mp4?.bitrate ?? 4e6 }) });
  output.addVideoTrack(source, { frameRate: job.fps });
  await output.start();

  const frames = Math.max(1, Math.round(projectDuration(project) * job.fps));
  for (let f = 0; f < frames; f++) {
    renderScene(project, f / job.fps, canvas, assets);
    await source.add(f / job.fps, 1 / job.fps);
    onProgress?.((f + 1) / frames);
  }
  source.close();
  await output.finalize();
  return new Blob([output.target.buffer!], { type: 'video/mp4' });
}
