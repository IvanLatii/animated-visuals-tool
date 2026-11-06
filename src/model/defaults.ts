import type { ClipInfo, Defaults, Easing, Frame, Layer, Motion, MotionType, Project, SafeZone, Stage, Transition, TransitionType } from './types';

export const CANVAS_PRESETS = {
  '1:1': { w: 1080, h: 1080 },
  '4:5': { w: 1080, h: 1350 },
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
} as const;

// Зум: різкий старт, дуже повільний кінець. Перехід: плавний з обох боків.
export const MOTION_EASING: Easing = { type: 'ease-out', strength: 3 };
export const TRANSITION_EASING: Easing = { type: 'ease-in-out', strength: 2 };

/** Рекомендовані параметри при виборі типу руху (зум і «без руху» нічого не міняють). Плавні, без різких стрибків. */
export const MOTION_DEFAULTS: Partial<Record<MotionType, Partial<Motion>>> = {
  focus: { intensity: 0.12, easing: { type: 'ease-in-out', strength: 2.5 } },
  appear: { intensity: 0.12, easing: { type: 'ease-out', strength: 3 } },
  rise: { intensity: 0.12, easing: { type: 'ease-out', strength: 4 } },
  pop: { intensity: 0.12, easing: { type: 'ease-out', strength: 4 } },
};

/** Рекомендована тривалість і крива при виборі переходу: швидкі, але не різкі. */
export const TRANSITION_DEFAULTS: Record<TransitionType, Partial<Transition>> = {
  cut: {},
  snap: { duration: 0.22, easing: { type: 'ease-out', strength: 4 } },
  crossfade: { duration: 0.35, easing: { type: 'ease-in-out', strength: 2 } },
  'wipe-up': { duration: 0.55, easing: { type: 'ease-out', strength: 4 } },
  'wipe-down': { duration: 0.55, easing: { type: 'ease-out', strength: 4 } },
  stripes: { duration: 0.8, easing: { type: 'ease-in-out', strength: 2.5 } },
  'stripes-alt': { duration: 0.8, easing: { type: 'ease-in-out', strength: 2.5 } },
  columns: { duration: 0.8, easing: { type: 'ease-in-out', strength: 2.5 } },
  'zoom-dissolve': { duration: 0.5, easing: { type: 'ease-in-out', strength: 2 } },
  'blur-dissolve': { duration: 0.5, easing: { type: 'ease-in-out', strength: 2 } },
};

export const DEFAULT_MOTION: Motion = { type: 'none', intensity: 0.12, easing: MOTION_EASING };
export const DEFAULT_TRANSITION: Transition = { type: 'crossfade', duration: 0.3, easing: TRANSITION_EASING };

export const DEFAULTS: Defaults = {
  frameDuration: 1.0,
  layerFit: 'fit', // зображення видно цілком, без обрізання; «Fill» вмикається окремо
  motion: DEFAULT_MOTION,
  transitionOut: DEFAULT_TRANSITION,
  clipFit: 'speed', // зміна тривалості кадру з відео міняє швидкість (кліп лишається цілим)
};

export function imageLayer(src: string): Layer {
  return { type: 'image', src, x: 0, y: 0, w: 1, h: 1 };
}

/**
 * Стартові safe-зони. Офіційних цифр знайшли лише для Instagram (і то в сторонніх джерелах, що цитують Meta:
 * зверху 14%, знизу 35%, з боків по 6% для Reels і Stories — 🟡 не підтверджено). Для LinkedIn, X і UXPUB
 * офіційних safe-зон не опубліковано, тому там стоїть умовні 5%, які користувач змінює сам.
 */
const NO_OFFICIAL = 'No official safe zone is published for this platform. The margin is a placeholder: set your own.';
const mk = (id: string, name: string, color: string): SafeZone => ({ id, name, color, top: 0.05, right: 0.05, bottom: 0.05, left: 0.05, visible: false, source: 'custom', note: NO_OFFICIAL });

// Порядок за пріоритетом Івана: LinkedIn, X, UXPUB, Medium, Instagram.
export const DEFAULT_SAFE_ZONES: SafeZone[] = [
  mk('linkedin', 'LinkedIn', '#0a8bff'),
  mk('x', 'X', '#b266ff'),
  mk('uxpub', 'UXPUB', '#00d08a'),
  mk('medium', 'Medium', '#ffb000'),
  { id: 'instagram', name: 'Instagram Reels / Stories', color: '#ff3b8d', top: 0.14, right: 0.06, bottom: 0.35, left: 0.06, visible: false, source: 'unverified',
    note: 'Figures come from third-party guides that cite Meta (14% top, 35% bottom, 6% sides). Not confirmed on an official Meta page. Some sources say 40% at the bottom for ads with a disclaimer.' },
  // 1080×1350 (4:5): профіль показує плитку 3:4, тож із боків обрізається ~34 px (3.1%). Для квадрата 1:1 це вже по 12.5% з боків.
  { id: 'instagram-post', name: 'Instagram Post (profile grid)', color: '#ff8a3d', top: 0, right: 0.031, bottom: 0, left: 0.031, visible: false, source: 'unverified',
    note: 'The profile grid shows posts as 3:4 tiles. For a 4:5 post (1080×1350) about 3.1% is cut from each side; for a square 1:1 post it is 12.5%. Third-party sources, not confirmed on an official Instagram page.' },
  { id: 'tiktok', name: 'TikTok', color: '#22d3ee', top: 0.08, right: 0.13, bottom: 0.25, left: 0.04, visible: false, source: 'unverified',
    note: 'Third-party sources disagree (top 100–150 px, bottom 250–480 px, right 100–140 px on 1080×1920). This is a middle value. TikTok publishes an official template on its ads help pages: check it before publishing.' },
  { id: 'youtube-shorts', name: 'YouTube Shorts', color: '#ff3b3b', top: 0.15, right: 0.178, bottom: 0.35, left: 0.044, visible: false, source: 'unverified',
    note: 'Figures attributed to Google for vertical video ads (288 px top, 672 px bottom, 192 px right, 48 px left on 1080×1920), reported by third-party sites. Other sources give smaller margins.' },
];

export const DEFAULT_STAGE: Stage = { slot: { x: 0, y: 0, w: 1, h: 1 }, radius: 0, shadow: 0 };

export function newProject(preset: keyof typeof CANVAS_PRESETS = '1:1'): Project {
  return {
    version: 1,
    name: 'Untitled project',
    canvas: { ...CANVAS_PRESETS[preset], preset, background: '#000000', safeZones: structuredClone(DEFAULT_SAFE_ZONES) },
    frames: [],
    defaults: structuredClone(DEFAULTS),
    stage: structuredClone(DEFAULT_STAGE),
  };
}

/** Кадр з усіма значеннями: власні перевизначення поверх defaults. */
export interface ResolvedFrame {
  frame: Frame;
  duration: number;
  motion: Motion;
  transitionOut: Transition;
}

/** Тривалість відрізка кліпу з урахуванням швидкості. */
export function clipLength(c: ClipInfo): number {
  return Math.max(0.05, (c.end - c.start) / c.speed);
}

/** Момент у джерелі для моменту frameT (секунди від початку кадру). Поза межами: повтор або останній кадр. */
export function clipSourceTime(c: ClipInfo, frameT: number): number {
  const L = Math.max(0.001, c.end - c.start);
  const run = Math.max(0, frameT) * c.speed;
  const within = c.loop ? run % L : Math.min(run, L - 0.001);
  return c.start + within;
}

/** Перший шар кадру з відео/GIF (за ним рахується тривалість кадру). */
export function clipLayerOf(frame: Frame): Layer | undefined {
  return frame.layers.find((l) => l.clip);
}

/** Тривалість кадру: власна, інакше довжина кліпу, інакше за замовчуванням. */
export function frameDuration(project: Project, frame: Frame): number {
  const clip = clipLayerOf(frame)?.clip;
  return frame.duration ?? (clip ? clipLength(clip) : project.defaults.frameDuration);
}

export function resolveFrame(project: Project, frame: Frame): ResolvedFrame {
  const d = project.defaults;
  return {
    frame,
    duration: frameDuration(project, frame),
    motion: { ...d.motion, ...frame.motion },
    transitionOut: { ...d.transitionOut, ...frame.transitionOut },
  };
}
