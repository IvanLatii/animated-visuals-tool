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

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

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


  // Те саме згори вниз: нове зображення з'являється зверху й опускається.
  'wipe-down': (ctx, p, drawPrev, drawNext) => {
    drawPrev();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height * p);
    ctx.clip();
    drawNext();
    ctx.restore();
  },

  // Смуги: горизонтальні смуги по черзі виїжджають зліва й справа, кожна трохи пізніше за попередню.
  stripes: (ctx, p, drawPrev, drawNext) => {
    drawPrev();
    const { width: W, height: H } = ctx.canvas;
    const n = 8, stagger = 0.5, bh = H / n;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const q = clamp01((p - (i / (n - 1)) * stagger) / (1 - stagger));
      const w = W * q;
      ctx.rect(i % 2 === 0 ? 0 : W - w, i * bh, w, bh + 0.5);
    }
    ctx.clip();
    drawNext();
    ctx.restore();
  },

  // Колонки: вертикальні колонки по черзі опускаються зверху вниз, зліва направо.
  columns: (ctx, p, drawPrev, drawNext) => {
    drawPrev();
    const { width: W, height: H } = ctx.canvas;
    const n = 10, stagger = 0.5, cw = W / n;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const q = clamp01((p - (i / (n - 1)) * stagger) / (1 - stagger));
      ctx.rect(i * cw, 0, cw + 0.5, H * q);
    }
    ctx.clip();
    drawNext();
    ctx.restore();
  },

  // Zoom dissolve: старе трохи наближається й тане, нове з'являється з наближення й стає на місце.
  'zoom-dissolve': (ctx, p, drawPrev, drawNext) => {
    const { width: W, height: H } = ctx.canvas;
    const scaled = (s: number, draw: () => void) => {
      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
      draw();
      ctx.restore();
    };
    scaled(1 + 0.12 * p, drawPrev);
    ctx.save();
    ctx.globalAlpha = p;
    scaled(1 + 0.12 * (1 - p), drawNext);
    ctx.restore();
  },

  // Blur dissolve: старе розмивається й тане, нове проявляється з розмиття. ctx.filter є в Chrome; Safari його не підтримує.
  'blur-dissolve': (ctx, p, drawPrev, drawNext) => {
    const px = (ctx.canvas.width / 1080) * 28;
    ctx.save();
    ctx.filter = `blur(${(px * p).toFixed(2)}px)`;
    drawPrev();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = p;
    ctx.filter = `blur(${(px * (1 - p)).toFixed(2)}px)`;
    drawNext();
    ctx.restore();
  },
};
