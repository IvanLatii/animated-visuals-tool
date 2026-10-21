import type { ExportJob, Project } from '../model/types';
import type { Assets } from '../render/renderScene';
import { exportGif } from './exportGif';
import { exportMp4 } from './exportMp4';

export interface ExportResult { job: ExportJob; blob: Blob }

/** Цикл по списку форматів. У версії 1 у списку один елемент; «усі формати за один апрув» — пізніше. */
export async function exportAll(
  project: Project,
  jobs: ExportJob[],
  assets: Assets,
  onProgress?: (jobIndex: number, p: number) => void,
): Promise<ExportResult[]> {
  const results: ExportResult[] = [];
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const cb = (p: number) => onProgress?.(i, p);
    const blob = job.format === 'gif'
      ? await exportGif(project, job, assets, cb)
      : await exportMp4(project, job, assets, cb);
    results.push({ job, blob });
  }
  return results;
}
