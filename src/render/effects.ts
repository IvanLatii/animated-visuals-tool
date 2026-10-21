import type { Motion, MotionType } from '../model/types';
import { applyEasing } from './easing';

/** Єдиний інтерфейс руху: прогрес кадру 0–1 → масштаб, зсув (у частках полотна) і поворот (радіани). */
export interface MotionTransform { scale: number; dx: number; dy: number; rotate: number }
export type MotionFn = (motion: Motion, progress: number, size: { w: number; h: number }) => MotionTransform;

const IDENTITY: MotionTransform = { scale: 1, dx: 0, dy: 0, rotate: 0 };

/** Панорама: картинку трохи збільшуємо (на intensity), щоб при зсуві не відкривалися краї; їде від +половини запасу до −половини. */
const pan = (axis: 'x' | 'y', sign: 1 | -1): MotionFn => (m, p) => {
  const half = m.intensity / 2;
  const shift = sign * half * (1 - 2 * applyEasing(m.easing, p));
  return { scale: 1 + m.intensity, dx: axis === 'x' ? shift : 0, dy: axis === 'y' ? shift : 0, rotate: 0 };
};

/** Нахил: кут = intensity × 15°. Масштаб такий, щоб повернутий кадр усе одно закривав полотно. */
const tilt = (sign: 1 | -1): MotionFn => (m, p, { w, h }) => {
  const max = m.intensity * 15 * (Math.PI / 180);
  const cover = Math.cos(max) + Math.sin(max) * Math.max(w / h, h / w);
  return { scale: cover, dx: 0, dy: 0, rotate: sign * max * applyEasing(m.easing, p) };
};

export const motions: Record<MotionType, MotionFn> = {
  none: () => IDENTITY,
  'zoom-in': (m, p) => ({ ...IDENTITY, scale: 1 + m.intensity * applyEasing(m.easing, p) }),
  'zoom-out': (m, p) => ({ ...IDENTITY, scale: 1 + m.intensity * (1 - applyEasing(m.easing, p)) }),
  'pan-left': pan('x', 1),
  'pan-right': pan('x', -1),
  'pan-up': pan('y', 1),
  'pan-down': pan('y', -1),
  'tilt-cw': tilt(1),
  'tilt-ccw': tilt(-1),
};
