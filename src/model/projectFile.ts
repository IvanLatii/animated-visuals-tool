import { newProject } from './defaults';
import type { Project } from './types';

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function projectFileName(project: Project): string {
  const slug = (project.name ?? '').trim().toLowerCase().replace(/[^a-z0-9Ѐ-ӿ]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug || 'untitled'}.avt.json`;
}

/** Читає файл проєкту, перевіряє форму й дописує відсутні значення за замовчуванням (на випадок старішого файлу). */
export function parseProject(json: string): Project {
  let data: Partial<Project> | null;
  try { data = JSON.parse(json); } catch { throw new Error('The file is not valid JSON'); }
  if (!data || data.version !== 1) throw new Error(`Unsupported project version: ${data?.version}`);
  if (!data.canvas || !Array.isArray(data.frames) || !data.defaults) throw new Error('The project file is corrupted');
  for (const f of data.frames) {
    if (typeof f?.id !== 'string' || !Array.isArray(f.layers) || f.layers.some((l) => typeof l?.src !== 'string')) {
      throw new Error('The project file has a broken frame');
    }
  }
  const base = newProject();
  return {
    ...base, ...data,
    canvas: { ...base.canvas, ...data.canvas },
    defaults: { ...base.defaults, ...data.defaults },
  } as Project;
}
