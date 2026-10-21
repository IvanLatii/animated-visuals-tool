import type { Project } from './types';

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function parseProject(json: string): Project {
  const data = JSON.parse(json);
  if (data?.version !== 1) throw new Error(`Непідтримувана версія проєкту: ${data?.version}`);
  if (!data.canvas || !Array.isArray(data.frames) || !data.defaults) throw new Error('Файл проєкту пошкоджений');
  return data as Project;
}
