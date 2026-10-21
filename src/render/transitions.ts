import type { TransitionType } from '../model/types';

/**
 * Єдиний інтерфейс переходу. progress — вже пропущений через криву, 0–1.
 * drawPrev / drawNext малюють відповідний кадр на canvas.
 */
export type TransitionFn = (
  ctx: CanvasRenderingContext2D,
  progress: number,
  drawPrev: () => void,
  drawNext: () => void,
) => void;

export const transitions: Record<TransitionType, TransitionFn> = {
  cut: (_ctx, _p, _drawPrev, drawNext) => drawNext(),

  crossfade: (ctx, p, drawPrev, drawNext) => {
    drawPrev();
    ctx.save();
    ctx.globalAlpha = p;
    drawNext();
    ctx.restore();
  },

  // Нове зображення виїжджає знизу вгору поверх попереднього: обрізаємо область малювання.
  'wipe-up': (ctx, p, drawPrev, drawNext) => {
    drawPrev();
    ctx.save();
    const h = ctx.canvas.height;
    ctx.beginPath();
    ctx.rect(0, h * (1 - p), ctx.canvas.width, h * p);
    ctx.clip();
    drawNext();
    ctx.restore();
  },
};
