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
    case 'back': { // старт швидкий, перелітає за 1 і повертається; strength 3 ≈ класичний easeOutBack
      const s = 0.57 * k;
      return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
    }
    case 'elastic': { // пружина: коливається навколо 1 й вгамовується; більша strength — частіші коливання
      if (t === 0 || t === 1) return t;
      const c = (2 * Math.PI) / 3 * (k / 3);
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
    }
  }
}
