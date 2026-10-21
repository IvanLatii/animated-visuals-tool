import type { Defaults, Easing, Frame, Layer, Motion, Project, SafeZone, Transition } from './types';

export const CANVAS_PRESETS = {
  '1:1': { w: 1080, h: 1080 },
  '4:5': { w: 1080, h: 1350 },
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
} as const;

// Зум: різкий старт, дуже повільний кінець. Перехід: плавний з обох боків.
export const MOTION_EASING: Easing = { type: 'ease-out', strength: 3 };
export const TRANSITION_EASING: Easing = { type: 'ease-in-out', strength: 2 };

export const DEFAULT_MOTION: Motion = { type: 'zoom-in', intensity: 0.2, easing: MOTION_EASING };
export const DEFAULT_TRANSITION: Transition = { type: 'crossfade', duration: 0.3, easing: TRANSITION_EASING };

export const DEFAULTS: Defaults = {
  frameDuration: 1.0,
  layerFit: 'fill',
  motion: DEFAULT_MOTION,
  transitionOut: DEFAULT_TRANSITION,
};

export function imageLayer(src: string): Layer {
  return { type: 'image', src, x: 0, y: 0, w: 1, h: 1 };
}

/**
 * Стартові safe-зони. Офіційних цифр знайшли лише для Instagram (і то в сторонніх джерелах, що цитують Meta:
 * зверху 14%, знизу 35%, з боків по 6% для Reels і Stories — 🟡 не підтверджено). Для LinkedIn, X і UXPUB
 * офіційних safe-зон не опубліковано, тому там стоїть умовні 5%, які користувач змінює сам.
 */
export const DEFAULT_SAFE_ZONES: SafeZone[] = [
  { id: 'instagram', name: 'Instagram Reels / Stories', color: '#ff3b8d', top: 0.14, right: 0.06, bottom: 0.35, left: 0.06, visible: false, source: 'unverified' },
  { id: 'linkedin', name: 'LinkedIn', color: '#0a8bff', top: 0.05, right: 0.05, bottom: 0.05, left: 0.05, visible: false, source: 'custom' },
  { id: 'x', name: 'X', color: '#9b59ff', top: 0.05, right: 0.05, bottom: 0.05, left: 0.05, visible: false, source: 'custom' },
  { id: 'uxpub', name: 'UXPUB', color: '#00c27a', top: 0.05, right: 0.05, bottom: 0.05, left: 0.05, visible: false, source: 'custom' },
];

export function newProject(preset: keyof typeof CANVAS_PRESETS = '1:1'): Project {
  return {
    version: 1,
    canvas: { ...CANVAS_PRESETS[preset], preset, background: '#000000', safeZones: structuredClone(DEFAULT_SAFE_ZONES) },
    frames: [],
    defaults: structuredClone(DEFAULTS),
  };
}

/** Кадр з усіма значеннями: власні перевизначення поверх defaults. */
export interface ResolvedFrame {
  frame: Frame;
  duration: number;
  motion: Motion;
  transitionOut: Transition;
}

export function resolveFrame(project: Project, frame: Frame): ResolvedFrame {
  const d = project.defaults;
  return {
    frame,
    duration: frame.duration ?? d.frameDuration,
    motion: { ...d.motion, ...frame.motion },
    transitionOut: { ...d.transitionOut, ...frame.transitionOut },
  };
}
