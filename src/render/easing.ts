import type { Easing } from '../model/types';

/** x: 0–1 → 0–1. strength — степінь кривої. */
export function applyEasing(e: Easing, x: number): number {
  const t = Math.min(1, Math.max(0, x));
  const k = Math.max(1, e.strength);
  switch (e.type) {
    case 'linear': return t;
    case 'ease-in': return Math.pow(t, k);
    case 'ease-out': return 1 - Math.pow(1 - t, k);
    case 'ease-in-out':
      return t < 0.5 ? Math.pow(2 * t, k) / 2 : 1 - Math.pow(2 * (1 - t), k) / 2;
  }
}
