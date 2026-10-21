import { CANVAS_PRESETS, imageLayer } from '../model/defaults';
import type { MotionProfile } from '../model/profiles';
import type { Frame, Motion, Project, SafeZone, Transition } from '../model/types';

// Чисті функції: беруть проєкт, повертають новий. Нічого не змінюють на місці.

export function newFrame(src: string): Frame {
  return { id: crypto.randomUUID(), layers: [imageLayer(src)] };
}

export function addFrames(project: Project, frames: Frame[]): Project {
  return { ...project, frames: [...project.frames, ...frames] };
}

/** Міняє картинку першого шару, усе інше в кадрі (тривалість, рух, перехід) лишається. */
export function replaceFrameImage(project: Project, id: string, src: string): Project {
  return mapFrame(project, id, (f) => ({ ...f, layers: f.layers.map((l, i) => (i === 0 ? { ...l, src } : l)) }));
}

export function setProjectName(project: Project, name: string): Project {
  return { ...project, name };
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

// --- Полотно ---

const even = (n: number) => Math.max(64, Math.min(4096, Math.round(n / 2) * 2)); // MP4 (H.264) потребує парних розмірів

export function setCanvasPreset(project: Project, preset: keyof typeof CANVAS_PRESETS | 'custom'): Project {
  if (preset === 'custom') return { ...project, canvas: { ...project.canvas, preset } };
  return { ...project, canvas: { ...project.canvas, ...CANVAS_PRESETS[preset], preset } };
}

export function setCanvasSize(project: Project, w: number, h: number): Project {
  return { ...project, canvas: { ...project.canvas, w: even(w), h: even(h), preset: 'custom' } };
}

export function setBackground(project: Project, color: string): Project {
  return { ...project, canvas: { ...project.canvas, background: color } };
}

// --- Safe-зони ---
export function updateSafeZone(project: Project, id: string, patch: Partial<SafeZone>): Project {
  return { ...project, canvas: { ...project.canvas, safeZones: project.canvas.safeZones.map((z) => (z.id === id ? { ...z, ...patch } : z)) } };
}

export function addSafeZone(project: Project): Project {
  const zone: SafeZone = { id: crypto.randomUUID(), name: 'Custom zone', color: '#ffb000', top: 0.05, right: 0.05, bottom: 0.05, left: 0.05, visible: true, source: 'custom' };
  return { ...project, canvas: { ...project.canvas, safeZones: [...project.canvas.safeZones, zone] } };
}

export function removeSafeZone(project: Project, id: string): Project {
  return { ...project, canvas: { ...project.canvas, safeZones: project.canvas.safeZones.filter((z) => z.id !== id) } };
}

// --- Значення за замовчуванням і перевизначення на рівні кадру ---
export function setDefaultFit(project: Project, fit: 'fit' | 'fill'): Project {
  return { ...project, defaults: { ...project.defaults, layerFit: fit } };
}

export function setDefaultMotion(project: Project, patch: Partial<Motion>): Project {
  return { ...project, defaults: { ...project.defaults, motion: { ...project.defaults.motion, ...patch } } };
}

export function setDefaultTransition(project: Project, patch: Partial<Transition>): Project {
  return { ...project, defaults: { ...project.defaults, transitionOut: { ...project.defaults.transitionOut, ...patch } } };
}

/** patch === undefined скидає перевизначення. */
export function setFrameMotion(project: Project, id: string, patch: Partial<Motion> | undefined): Project {
  return mapFrame(project, id, (f) => {
    const { motion: _old, ...rest } = f; void _old;
    return patch === undefined ? rest : { ...rest, motion: { ...f.motion, ...patch } };
  });
}

export function setFrameTransition(project: Project, id: string, patch: Partial<Transition> | undefined): Project {
  return mapFrame(project, id, (f) => {
    const { transitionOut: _old, ...rest } = f; void _old;
    return patch === undefined ? rest : { ...rest, transitionOut: { ...f.transitionOut, ...patch } };
  });
}

export function setFrameFit(project: Project, id: string, fit: 'fit' | 'fill' | undefined): Project {
  return mapFrame(project, id, (f) => ({
    ...f,
    layers: f.layers.map((l) => {
      const { fit: _old, ...rest } = l; void _old;
      return fit === undefined ? rest : { ...rest, fit };
    }),
  }));
}

function mapFrame(project: Project, id: string, fn: (f: Frame) => Frame): Project {
  return { ...project, frames: project.frames.map((f) => (f.id === id ? fn(f) : f)) };
}

/** Профіль на весь проєкт. Один крок — стає значенням за замовчуванням (перевизначення кадрів зникають), кілька — розкладаються по кадрах. */
export function applyMotionProfile(project: Project, profile: MotionProfile): Project {
  const defaults = { ...project.defaults, motion: { ...profile.steps[0] } };
  const frames = project.frames.map((f, i) => {
    const { motion: _old, ...rest } = f; void _old;
    return profile.steps.length === 1 ? rest : { ...rest, motion: { ...profile.steps[i % profile.steps.length] } };
  });
  return { ...project, defaults, frames };
}

/** Змінює загальну тривалість: усі тривалості кадрів (і значення за замовчуванням) масштабуються пропорційно. */
export function scaleTotalDuration(project: Project, total: number): Project {
  const current = project.frames.reduce((sum, f) => sum + (f.duration ?? project.defaults.frameDuration), 0);
  if (current <= 0 || total <= 0) return project;
  const k = total / current;
  const scale = (v: number) => Math.min(30, Math.max(0.1, Math.round(v * k * 100) / 100));
  return {
    ...project,
    defaults: { ...project.defaults, frameDuration: scale(project.defaults.frameDuration) },
    frames: project.frames.map((f) => (f.duration === undefined ? f : { ...f, duration: scale(f.duration) })),
  };
}
