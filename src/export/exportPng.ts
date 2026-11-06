import type { ExportJob, Project } from '../model/types';
import { prepareClips, renderScene, type Assets } from '../render/renderScene';
import type { ExportOptions } from './exportGif';
import { exportSize } from './renderFrames';

/** Один кадр сцени в момент opts.time (там, де стоїть перемотування). */
export async function exportPng(project: Project, job: ExportJob, assets: Assets, opts: ExportOptions = {}): Promise<Blob> {
  const { w, h } = exportSize(project, job.scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  await prepareClips(project, opts.time ?? 0, assets);
  renderScene(project, opts.time ?? 0, canvas, assets);
  opts.onStatus?.('Encoding PNG', null);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the PNG'))), 'image/png'));
}
