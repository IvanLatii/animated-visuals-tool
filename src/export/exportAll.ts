import type { ExportJob, Project } from '../model/types';
import type { Assets } from '../render/renderScene';
import { exportGif, type ExportOptions } from './exportGif';
import { exportMp4 } from './exportMp4';
import { exportPng } from './exportPng';

export interface ExportResult { job: ExportJob; blob: Blob }

/** Цикл по списку форматів. У версії 1 у списку один елемент; «усі формати за один апрув» — пізніше. */
export async function exportAll(project: Project, jobs: ExportJob[], assets: Assets, opts: ExportOptions = {}): Promise<ExportResult[]> {
  const results: ExportResult[] = [];
  for (const job of jobs) {
    const blob = job.format === 'gif' ? await exportGif(project, job, assets, opts)
      : job.format === 'png' ? await exportPng(project, job, assets, opts)
        : await exportMp4(project, job, assets, opts);
    results.push({ job, blob });
  }
  return results;
}
