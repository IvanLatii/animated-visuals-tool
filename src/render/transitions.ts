import type { TransitionType } from '../model/types';

/**
 * Єдиний інтерфейс переходу. progress — вже пропущений через криву, 0–1
 * (з кривими Back/Elastic може виходити за ці межі, тому прозорість і розмиття обмежуємо clamp01).
 * drawPrev / drawNext малюють відповідний кадр у вікні вмісту.
 */
export interface Size { w: number; h: number }
export type TransitionFn = (
  ctx: CanvasRenderingContext2D,
  progress: number,
  drawPrev: () => void,
  drawNext: () => void,
  size: Size, // область, у якій грають кадри (вікно вмісту)
) => void;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Малює через зсув і масштаб відносно центру області. */
function shifted(ctx: CanvasRenderingContext2D, { w, h }: Size, dy: number, scale: number, draw: () => void) {
  ctx.save();
  ctx.translate(w / 2, h / 2 + dy);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  draw();
  ctx.restore();
}

/** Смуги: кожна наступна стартує трохи пізніше; q — прогрес однієї смуги. */
const stagger = (p: number, i: number, n: number, share: number) => clamp01((p - (i / (n - 1)) * share) / (1 - share));

function stripes(alternate: boolean): TransitionFn {
  return (ctx, p, drawPrev, drawNext, { w: W, h: H }) => {
    drawPrev();
    const n = 8, bh = H / n;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const w = W * stagger(p, i, n, 0.6);
      ctx.rect(alternate && i % 2 === 1 ? W - w : 0, i * bh, w, bh + 0.5); // «alt»: по черзі зліва й справа; інакше всі зліва
    }
    ctx.clip();
    drawNext();
    ctx.restore();
  };
}

/** Хвиля знизу вгору або згори вниз: нове зображення відкривається, трохи «долітаючи» на місце, старе злегка віддаляється — відчувається вага. */
function wipe(up: boolean): TransitionFn {
  return (ctx, p, drawPrev, drawNext, size) => {
    const { w, h } = size;
    shifted(ctx, size, (up ? -1 : 1) * 0.04 * h * clamp01(p), 1, drawPrev);
    ctx.save();
    ctx.beginPath();
    if (up) ctx.rect(0, h * (1 - p), w, h * p); else ctx.rect(0, 0, w, h * p);
    ctx.clip();
    shifted(ctx, size, (up ? 1 : -1) * 0.08 * h * (1 - clamp01(p)), 1, drawNext);
    ctx.restore();
  };
}

export const transitions: Record<TransitionType, TransitionFn> = {
  cut: (_ctx, _p, _drawPrev, drawNext) => drawNext(),

  // Snap: майже миттєва зміна, але нове зображення «осідає» з трохи більшого розміру — не такий жорсткий, як cut.
  snap: (ctx, p, drawPrev, drawNext, size) => {
    drawPrev();
    ctx.save();
    ctx.globalAlpha = clamp01(p * 5);
    shifted(ctx, size, 0, 1 + 0.04 * (1 - clamp01(p)), drawNext);
    ctx.restore();
  },

  crossfade: (ctx, p, drawPrev, drawNext) => {
    drawPrev();
    ctx.save();
    ctx.globalAlpha = clamp01(p);
    drawNext();
    ctx.restore();
  },

  'wipe-up': wipe(true),
  'wipe-down': wipe(false),

  stripes: stripes(false),
  'stripes-alt': stripes(true),

  // Колонки: вертикальні колонки по черзі опускаються зверху вниз, зліва направо.
  columns: (ctx, p, drawPrev, drawNext, { w: W, h: H }) => {
    drawPrev();
    const n = 10, cw = W / n;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < n; i++) ctx.rect(i * cw, 0, cw + 0.5, H * stagger(p, i, n, 0.6));
    ctx.clip();
    drawNext();
    ctx.restore();
  },

  // Лишився для старих проєктів, у списку прихований.
  'zoom-dissolve': (ctx, p, drawPrev, drawNext, size) => {
    shifted(ctx, size, 0, 1 + 0.12 * p, drawPrev);
    ctx.save();
    ctx.globalAlpha = clamp01(p);
    shifted(ctx, size, 0, 1 + 0.12 * (1 - p), drawNext);
    ctx.restore();
  },

  // Blur dissolve: старе трохи розмивається й тане, нове проявляється з легкого розмиття й м'яко стає на місце. Розмиття невелике, щоб не «пливло».
  'blur-dissolve': (ctx, p, drawPrev, drawNext, size) => {
    const px = (size.w / 1080) * 14;
    const q = clamp01(p);
    ctx.save();
    ctx.filter = `blur(${(px * q).toFixed(2)}px)`;
    drawPrev();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = q;
    ctx.filter = `blur(${(px * (1 - q)).toFixed(2)}px)`;
    shifted(ctx, size, 0, 1 + 0.015 * (1 - q), drawNext);
    ctx.restore();
  },
};
