import { imageLayer, newProject } from './model/defaults';
import type { Project } from './model/types';

// Тимчасові тестові «скриншоти» з градієнтами. Зникнуть, коли з'явиться завантаження файлів.
function shot(i: number): string {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 1000;
  const g = c.getContext('2d')!;
  const hues = [[250, 320], [160, 210], [20, 60]][i];
  const grad = g.createLinearGradient(0, 0, 1600, 1000);
  grad.addColorStop(0, `hsl(${hues[0]} 70% 55%)`); grad.addColorStop(1, `hsl(${hues[1]} 80% 35%)`);
  g.fillStyle = grad; g.fillRect(0, 0, 1600, 1000);
  g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(120, 120, 1360, 760);
  g.fillStyle = '#222'; g.font = 'bold 72px system-ui'; g.fillText(`Screen ${i + 1}`, 180, 240);
  g.font = '32px system-ui'; g.fillStyle = '#666';
  for (let r = 0; r < 6; r++) g.fillText('Lorem ipsum dolor sit amet, consectetur adipiscing', 180, 330 + r * 60);
  return c.toDataURL('image/png');
}

export function demoProject(): Project {
  const p = newProject('1:1');
  p.frames = [0, 1, 2].map((i) => ({ id: `f${i}`, layers: [imageLayer(shot(i))] }));
  return p;
}
