import type { Motion, MotionType } from '../model/types';
import { applyEasing } from './easing';

/** Єдиний інтерфейс руху: прогрес кадру 0–1 → масштаб, зсув (у частках полотна) і поворот (радіани). */
export interface MotionTransform { scale: number; dx: number; dy: number; rotate: number; blur?: number } // blur — частка ширини
export type MotionFn = (motion: Motion, progress: number, size: { w: number; h: number }) => MotionTransform;

const IDENTITY: MotionTransform = { scale: 1, dx: 0, dy: 0, rotate: 0, blur: 0 };

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

/** Діагональний дрейф: наближення + зсув; масштаб ніколи не менший за запас, тож краї не відкриваються. sx/sy — куди їде картинка. */
const drift = (sx: 1 | -1, sy: 1 | -1): MotionFn => (m, p) => {
  const e = applyEasing(m.easing, p);
  const shift = 0.25 * m.intensity * (1 - 2 * e);
  return { ...IDENTITY, scale: 1 + m.intensity * (0.5 + 0.5 * e), dx: sx * shift, dy: sy * shift };
};

export const motions: Record<MotionType, MotionFn> = {
  none: () => IDENTITY,
  'zoom-in': (m, p) => ({ ...IDENTITY, scale: 1 + m.intensity * applyEasing(m.easing, p) }),
  breathe: (m, p) => ({ ...IDENTITY, scale: 1 + m.intensity * Math.sin(Math.PI * applyEasing(m.easing, p)) }),
  'zoom-out': (m, p) => ({ ...IDENTITY, scale: 1 + m.intensity * (1 - applyEasing(m.easing, p)) }),
  'pan-left': pan('x', 1),
  'pan-right': pan('x', -1),
  'pan-up': pan('y', 1),
  'pan-down': pan('y', -1),
  'tilt-cw': tilt(1),
  'tilt-ccw': tilt(-1),
  'drift-ul': drift(-1, -1),
  'drift-ur': drift(1, -1),
  'drift-dl': drift(-1, 1),
  'drift-dr': drift(1, 1),
  float: (m, p, { w, h }) => {
    // Один повний цикл: вгору-вниз і легкий нахил. Масштаб із запасом, щоб краї не відкривались.
    const a = m.intensity * 0.1, max = m.intensity * 3 * (Math.PI / 180);
    const cover = Math.cos(max) + Math.sin(max) * Math.max(w / h, h / w) + 2 * a;
    return { ...IDENTITY, scale: cover, dy: a * Math.sin(2 * Math.PI * p), rotate: max * Math.sin(2 * Math.PI * p + Math.PI / 2) };
  },
  // Pop in: з меншого розміру до 1; гарно виглядає з кривою Back або Elastic. Тло вікна на старті видно.
  pop: (m, p) => ({ ...IDENTITY, scale: 1 - m.intensity + m.intensity * applyEasing(m.easing, p) }),
  // Focus in: розмите стає різким, з легким наближенням. Блюр — частка ширини.
  focus: (m, p) => {
    const e = applyEasing(m.easing, p);
    return { ...IDENTITY, scale: 1 + 0.04 * (1 - e) * (m.intensity / 0.2), blur: Math.max(0, m.intensity * 0.12 * (1 - e)) };
  },
  // Handheld: м'яке «тремтіння руки». Цілі частоти, тому початок і кінець збігаються (зручно в циклі).
  handheld: (m, p, { w, h }) => {
    const a = m.intensity * 0.04, r = m.intensity * 0.02;
    const t = 2 * Math.PI * p;
    const cover = Math.cos(r) + Math.sin(r) * Math.max(w / h, h / w) + 2.2 * a;
    return {
      ...IDENTITY, scale: cover,
      dx: a * (0.6 * Math.sin(2 * t + 0.4) + 0.4 * Math.sin(5 * t + 1.9)),
      dy: a * (0.6 * Math.sin(3 * t + 2.2) + 0.4 * Math.sin(7 * t + 0.7)),
      rotate: r * (0.7 * Math.sin(2 * t + 1.1) + 0.3 * Math.sin(6 * t)),
    };
  },
};
