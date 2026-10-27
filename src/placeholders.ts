import type { Assets } from './render/renderScene';

// Демонстраційні «скриншоти» для прев'ю пресетів: абстрактні екрани застосунку, щоб було видно, як пресет поводиться.
const HUES = [215, 155, 25];

function draw(hue: number): string {
  const c = document.createElement('canvas');
  c.width = 600; c.height = 800;
  const g = c.getContext('2d')!;
  g.fillStyle = `hsl(${hue} 25% 94%)`; g.fillRect(0, 0, 600, 800);
  g.fillStyle = `hsl(${hue} 55% 48%)`; g.fillRect(0, 0, 600, 120);
  g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(40, 44, 180, 28);
  g.fillStyle = `hsl(${hue} 60% 62%)`; g.fillRect(40, 160, 520, 260);
  g.fillStyle = `hsl(${hue} 30% 80%)`; for (let i = 0; i < 4; i++) g.fillRect(40, 460 + i * 64, i % 2 ? 360 : 460, 28);
  g.fillStyle = `hsl(${hue} 55% 38%)`; g.fillRect(40, 724, 520, 44);
  return c.toDataURL('image/png');
}

let cache: Promise<{ srcs: string[]; assets: Assets }> | null = null;

export function placeholders(): Promise<{ srcs: string[]; assets: Assets }> {
  cache ??= (async () => {
    const srcs = HUES.map(draw);
    const assets: Assets = new Map();
    await Promise.all(srcs.map((src) => new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => { assets.set(src, img); resolve(); };
      img.onerror = () => reject(new Error('placeholder'));
      img.src = src;
    })));
    return { srcs, assets };
  })();
  return cache;
}
