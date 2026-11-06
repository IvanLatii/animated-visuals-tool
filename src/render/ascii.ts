import type { AsciiSettings } from '../model/types';

export const ASCII_DEFAULT: AsciiSettings = {
  enabled: false,
  cell: 0.012,
  chars: '@#*+-. ',
  source: 'brightness',
  invert: false,
  contrast: 1,
  edges: 0.3,
  colorMode: 'single',
  color: '#5a4fe0',
  background: '#ffffff',
};

export const ASCII_PRESETS: { id: string; label: string; settings: Partial<AsciiSettings> }[] = [
  { id: 'reference', label: 'Reference (violet on white)', settings: { chars: '@#*+-. ', color: '#5a4fe0', background: '#ffffff', invert: false, colorMode: 'single', source: 'brightness' } },
  { id: 'mono-black', label: 'Mono black', settings: { chars: '@#*+-. ', color: '#111111', background: '#ffffff', invert: false, colorMode: 'single', source: 'brightness' } },
  { id: 'mono-white', label: 'Mono white', settings: { chars: '@#*+-. ', color: '#ffffff', background: '#000000', invert: true, colorMode: 'single', source: 'brightness' } },
  { id: 'color-mosaic', label: 'Color mosaic', settings: { chars: '@#*+-. ', color: '#ffffff', background: '#000000', invert: true, colorMode: 'image', source: 'brightness' } },
  { id: 'logo', label: 'Logo silhouette (alpha)', settings: { chars: '@#*+-. ', color: '#5a4fe0', background: '#ffffff', invert: false, colorMode: 'single', source: 'alpha', edges: 0.5 } },
];

export function resolveAscii(s: Partial<AsciiSettings> | undefined): AsciiSettings {
  return { ...ASCII_DEFAULT, ...s };
}

const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const GLYPH_W = 0.6; // ширина символа моноширинного шрифту в частках кегля

let small: HTMLCanvasElement | null = null;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Перетворює зображення src на символи й малює їх у out (тієї ж розмірності).
 * Чиста щодо проєкту: бере лише налаштування. Малює в out з нуля.
 */
export function renderAscii(src: HTMLCanvasElement, out: HTMLCanvasElement, settings: AsciiSettings): void {
  const W = out.width, H = out.height;
  const ctx = out.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);
  if (settings.background) { ctx.fillStyle = settings.background; ctx.fillRect(0, 0, W, H); }

  const cols = Math.max(4, Math.round(1 / Math.max(0.003, settings.cell)));
  const cw = W / cols;
  const font = cw / GLYPH_W; // кегль; висота клітинки = кегль
  const rows = Math.max(2, Math.round(H / font));
  const ch = H / rows;

  // Зменшуємо до сітки: кожен піксель = клітинка (усереднення робить браузер)
  small ??= document.createElement('canvas');
  small.width = cols; small.height = rows;
  const sctx = small.getContext('2d', { willReadFrequently: true })!;
  sctx.clearRect(0, 0, cols, rows);
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(src, 0, 0, cols, rows);
  const px = sctx.getImageData(0, 0, cols, rows).data;

  // Щільність «чорнила» 0–1 для кожної клітинки
  const ink = new Float32Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], a = px[i * 4 + 3] / 255;
    let v: number;
    if (settings.source === 'alpha') v = settings.invert ? 1 - a : a;
    else {
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      v = a * (settings.invert ? lum : 1 - lum);
    }
    ink[i] = clamp01((v - 0.5) * settings.contrast + 0.5) * (settings.source === 'alpha' || a > 0 ? 1 : 0);
  }

  // Контури (Собель по щільності): підсилюють межі, щоб форма читалась
  const base = settings.edges > 0 ? Float32Array.from(ink) : ink;
  if (settings.edges > 0) {
    const at = (x: number, y: number) => base[Math.min(rows - 1, Math.max(0, y)) * cols + Math.min(cols - 1, Math.max(0, x))];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const gx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const gy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      const mag = Math.min(1, Math.hypot(gx, gy) / 2);
      const i = y * cols + x;
      ink[i] = clamp01(base[i] + settings.edges * mag * 0.8);
    }
  }

  const chars = settings.chars.length ? settings.chars : ASCII_DEFAULT.chars;
  const n = chars.length;
  ctx.font = `${font}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (settings.colorMode === 'single') ctx.fillStyle = settings.color;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x;
    const v = ink[i];
    if (v < 0.04) continue;
    const c = chars[Math.min(n - 1, Math.round((1 - v) * (n - 1)))];
    if (c === ' ') continue;
    if (settings.colorMode === 'image') ctx.fillStyle = `rgb(${px[i * 4]},${px[i * 4 + 1]},${px[i * 4 + 2]})`;
    ctx.fillText(c, (x + 0.5) * cw, (y + 0.5) * ch);
  }
}
