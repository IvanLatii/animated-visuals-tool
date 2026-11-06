import { CANVAS_PRESETS, clipLength, frameDuration, imageLayer } from '../model/defaults';
import type { MotionProfile } from '../model/profiles';
import type { AsciiSettings, ClipInfo, Frame, Layer, Motion, Project, Rect, SafeZone, Stage, Transition } from '../model/types';

// Чисті функції: беруть проєкт, повертають новий. Нічого не змінюють на місці.

export function newFrame(src: string, name?: string, clip?: ClipInfo): Frame {
  return { id: crypto.randomUUID(), name, layers: [clip ? { ...imageLayer(src), clip } : imageLayer(src)] };
}

export function addFrames(project: Project, frames: Frame[]): Project {
  return { ...project, frames: [...project.frames, ...frames] };
}

/** Міняє картинку першого шару, усе інше в кадрі (тривалість, рух, перехід) лишається. */
export function replaceFrameImage(project: Project, id: string, src: string, name?: string, clip?: ClipInfo): Project {
  return mapFrame(project, id, (f) => {
    const hadClip = f.layers[0]?.clip !== undefined;
    const { duration: _d, ...rest } = f; void _d;
    return {
      ...(clip || hadClip ? rest : f), name: name ?? f.name,
      layers: f.layers.map((l, i) => {
        if (i !== 0) return l;
        const { clip: _c, ...nl } = l; void _c;
        return clip ? { ...nl, src, clip } : { ...nl, src };
      }),
    };
  });
}

/** Зміна параметрів кліпу кадру. Довжина (початок, кінець, швидкість) міняє тривалість кадру, тож власну тривалість знімаємо: кадр знову слідує за кліпом. */
export function setClip(project: Project, ids: string[], patch: Partial<Pick<ClipInfo, 'start' | 'end' | 'speed' | 'loop'>>): Project {
  const lengthChanges = patch.start !== undefined || patch.end !== undefined || patch.speed !== undefined;
  return {
    ...project,
    frames: project.frames.map((f) => {
      const c = f.layers[0]?.clip;
      if (!ids.includes(f.id) || !c) return f;
      const next = { ...c, ...patch };
      next.start = Math.min(Math.max(0, next.start), Math.max(0, c.duration - 0.05));
      next.end = Math.min(c.duration, Math.max(next.start + 0.05, next.end));
      next.speed = Math.min(8, Math.max(0.1, next.speed));
      const { duration: _d, ...rest } = f; void _d;
      return { ...(lengthChanges ? rest : f), layers: f.layers.map((l, i) => (i === 0 ? { ...l, clip: next } : l)) };
    }),
  };
}

export function setClipFit(project: Project, fit: 'speed' | 'trim'): Project {
  return { ...project, defaults: { ...project.defaults, clipFit: fit } };
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
      const clip = f.layers[0]?.clip;
      if (clip && duration !== undefined && project.defaults.clipFit !== 'trim') {
        // Режим Speed: кліп вміщується цілком, швидкість підлаштовується під нову тривалість
        const speed = Math.min(8, Math.max(0.1, (clip.end - clip.start) / duration));
        return { ...rest, layers: f.layers.map((l, i) => (i === 0 ? { ...l, clip: { ...clip, speed } } : l)) };
      }
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

/** patch мерджиться в наявні налаштування; undefined прибирає ASCII з кадру. */
export function setFrameAscii(project: Project, id: string, patch: Partial<AsciiSettings> | undefined): Project {
  return mapFrame(project, id, (f) => {
    const { ascii: _old, ...rest } = f; void _old;
    return patch === undefined ? rest : { ...rest, ascii: { ...f.ascii, ...patch } };
  });
}

/** Вибір Fit/Fill також скидає ручні розмір, зсув і поворот: інакше правки зверху ховають результат і здається, що кнопка не працює. undefined лише знімає перевизначення. */
export function setFrameFit(project: Project, id: string, fit: 'fit' | 'fill' | undefined): Project {
  return mapFrame(project, id, (f) => ({
    ...f,
    layers: f.layers.map((l) => {
      const { fit: _old, scaleX: _a, scaleY: _b, dx: _c, dy: _d, rotation: _e, ...rest } = l;
      void _old; void _a; void _b; void _c; void _d; void _e;
      if (fit === undefined) return { ...rest, scaleX: l.scaleX, scaleY: l.scaleY, dx: l.dx, dy: l.dy, rotation: l.rotation };
      return { ...rest, fit };
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
  const current = project.frames.reduce((sum, f) => sum + frameDuration(project, f), 0);
  if (current <= 0 || total <= 0) return project;
  const k = total / current;
  const scale = (v: number) => Math.min(30, Math.max(0.1, Math.round(v * k * 100) / 100));
  return {
    ...project,
    defaults: { ...project.defaults, frameDuration: scale(project.defaults.frameDuration) },
    frames: project.frames.map((f) => {
      const clip = f.layers[0]?.clip;
      if (clip && f.duration === undefined) { // кліп без власної тривалості: Speed міняє швидкість, Trim фіксує нову тривалість
        if (project.defaults.clipFit === 'trim') return { ...f, duration: scale(clipLength(clip)) };
        const speed = Math.min(8, Math.max(0.1, clip.speed / k));
        return { ...f, layers: f.layers.map((l, i) => (i === 0 ? { ...l, clip: { ...clip, speed } } : l)) };
      }
      return f.duration === undefined ? f : { ...f, duration: scale(f.duration) };
    }),
  };
}

// --- Сцена: фон, накладка, вікно вмісту ---
export function setStageImage(project: Project, kind: 'background' | 'overlay', src: string | undefined, name?: string): Project {
  return { ...project, stage: { ...project.stage, [kind]: src, [`${kind}Name`]: src ? name : undefined } };
}

/** Рухає або змінює розмір вікна; тримає його в межах полотна й не менше 2%. */
export function setSlot(project: Project, patch: Partial<Rect>): Project {
  const s = { ...project.stage.slot, ...patch };
  const w = Math.min(1, Math.max(0.02, s.w)), h = Math.min(1, Math.max(0.02, s.h));
  const slot = { w, h, x: Math.min(1 - w, Math.max(0, s.x)), y: Math.min(1 - h, Math.max(0, s.y)) };
  return { ...project, stage: { ...project.stage, slot } };
}

export function setStageStyle(project: Project, patch: Partial<Pick<Stage, 'radius' | 'shadow'>>): Project {
  return { ...project, stage: { ...project.stage, ...patch } };
}

/** Підганяє вікно під пропорції картинки (imgW × imgH), лишаючи ширину; якщо не влазить — зменшує. */
export function fitSlotToImage(project: Project, imgW: number, imgH: number): Project {
  const { w: cw, h: ch } = project.canvas;
  const slot = project.stage.slot;
  let wPx = slot.w * cw;
  let hPx = (wPx * imgH) / imgW;
  const maxH = (1 - slot.y) * ch;
  if (hPx > maxH) { hPx = maxH; wPx = (hPx * imgW) / imgH; }
  return setSlot(project, { w: wPx / cw, h: hPx / ch });
}

// --- Перетворення виділених зображень ---
type LayerPatch = Partial<Pick<Layer, 'scaleX' | 'scaleY' | 'dx' | 'dy' | 'rotation'>>;

/** Застосовує fn до кожного шару кожного кадру з ids. */
export function mapLayersOf(project: Project, ids: string[], fn: (layer: Layer, frame: Frame) => Layer): Project {
  const set = new Set(ids);
  return { ...project, frames: project.frames.map((f) => (set.has(f.id) ? { ...f, layers: f.layers.map((l) => fn(l, f)) } : f)) };
}

export function patchLayers(project: Project, ids: string[], patch: LayerPatch): Project {
  return mapLayersOf(project, ids, (l) => ({ ...l, ...patch }));
}

/** Множник розміру від поточного (зберігає різницю між зображеннями). */
export function scaleLayers(project: Project, ids: string[], factor: number): Project {
  const clamp = (v: number) => Math.min(8, Math.max(0.05, v));
  return mapLayersOf(project, ids, (l) => ({ ...l, scaleX: clamp((l.scaleX ?? 1) * factor), scaleY: clamp((l.scaleY ?? 1) * factor) }));
}

/** Ширина (або висота) задається числом; з увімкненим замком пропорцій друга сторона змінюється так само. */
export function setLayerScale(project: Project, ids: string[], axis: 'x' | 'y', value: number, keepRatio: boolean): Project {
  const v = Math.min(8, Math.max(0.05, value));
  return mapLayersOf(project, ids, (l) => {
    const sx = l.scaleX ?? 1, sy = l.scaleY ?? 1;
    if (axis === 'x') return { ...l, scaleX: v, scaleY: keepRatio ? Math.min(8, Math.max(0.05, sy * (v / sx))) : sy };
    return { ...l, scaleY: v, scaleX: keepRatio ? Math.min(8, Math.max(0.05, sx * (v / sy))) : sx };
  });
}

export function resetLayerTransform(project: Project, ids: string[]): Project {
  return mapLayersOf(project, ids, (l) => {
    const { scaleX: _a, scaleY: _b, dx: _c, dy: _d, rotation: _e, ...rest } = l;
    void _a; void _b; void _c; void _d; void _e;
    return rest;
  });
}

/** Застосовує різні зміни до перших шарів різних кадрів (перетягування мишею). */
export function applyLayerPatches(project: Project, patches: Record<string, LayerPatch>): Project {
  return { ...project, frames: project.frames.map((f) => (patches[f.id] ? { ...f, layers: f.layers.map((l, i) => (i === 0 ? { ...l, ...patches[f.id] } : l)) } : f)) };
}
