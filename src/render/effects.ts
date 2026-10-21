import type { Motion, MotionType } from '../model/types';
import { applyEasing } from './easing';

/** Єдиний інтерфейс руху: прогрес кадру 0–1 → масштаб і зсув (зсув у частках полотна). */
export interface MotionTransform { scale: number; dx: number; dy: number }
export type MotionFn = (motion: Motion, progress: number) => MotionTransform;

const IDENTITY: MotionTransform = { scale: 1, dx: 0, dy: 0 };

export const motions: Record<MotionType, MotionFn> = {
  none: () => IDENTITY,
  'zoom-in': (m, p) => ({ scale: 1 + m.intensity * applyEasing(m.easing, p), dx: 0, dy: 0 }),
  'zoom-out': (m, p) => ({ scale: 1 + m.intensity * (1 - applyEasing(m.easing, p)), dx: 0, dy: 0 }),
  // 'pan' і 'rotate' — пізніше, за замовчуванням вимкнені.
};
