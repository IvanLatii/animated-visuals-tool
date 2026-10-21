import { imageLayer } from '../model/defaults';
import type { Frame, Project } from '../model/types';

// Чисті функції: беруть проєкт, повертають новий. Нічого не змінюють на місці.

export function newFrame(src: string): Frame {
  return { id: crypto.randomUUID(), layers: [imageLayer(src)] };
}

export function addFrames(project: Project, frames: Frame[]): Project {
  return { ...project, frames: [...project.frames, ...frames] };
}

export function removeFrame(project: Project, id: string): Project {
  return { ...project, frames: project.frames.filter((f) => f.id !== id) };
}

/** Переставляє кадр з позиції from на позицію to (to — індекс у підсумковому списку). */
export function moveFrame(project: Project, from: number, to: number): Project {
  const n = project.frames.length;
  if (from === to || from < 0 || from >= n || to < 0 || to >= n) return project;
  const frames = [...project.frames];
  const [moved] = frames.splice(from, 1);
  frames.splice(to, 0, moved);
  return { ...project, frames };
}

/** duration === undefined скидає до значення за замовчуванням. */
export function setFrameDuration(project: Project, id: string, duration: number | undefined): Project {
  return {
    ...project,
    frames: project.frames.map((f) => {
      if (f.id !== id) return f;
      const { duration: _old, ...rest } = f;
      void _old;
      return duration === undefined ? rest : { ...rest, duration };
    }),
  };
}

export function setDefaultFrameDuration(project: Project, duration: number): Project {
  return { ...project, defaults: { ...project.defaults, frameDuration: duration } };
}
