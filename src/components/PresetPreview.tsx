import { useEffect, useMemo, useRef, useState } from 'react';
import { placeholders } from '../placeholders';
import { imageLayer, newProject } from '../model/defaults';
import type { Project } from '../model/types';
import type { Preset } from '../presets';
import { projectDuration, renderScene, type Assets } from '../render/renderScene';

const BOX = 92; // найбільша сторона міні-прев'ю, px екрана

/** Міні-прев'ю пресету: полотно, вікно, рух і перехід на демонстраційних картинках. Грає, поки курсор над карткою. */
export function PresetPreview({ preset, playing }: { preset: Preset; playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ph, setPh] = useState<{ srcs: string[]; assets: Assets } | null>(null);
  useEffect(() => { void placeholders().then(setPh); }, []);

  const { w, h } = preset.data.canvas;
  const k = (2 * BOX) / Math.max(w, h); // удвічі більше за екранний розмір — чіткіше на ретіні
  const cw = Math.max(2, Math.round(w * k)), ch = Math.max(2, Math.round(h * k));

  const project = useMemo<Project | null>(() => {
    if (!ph) return null;
    const p = newProject();
    p.canvas = { ...p.canvas, ...preset.data.canvas, w: cw, h: ch, safeZones: [] };
    p.defaults = structuredClone(preset.data.defaults);
    if (preset.data.stage) p.stage = { ...p.stage, ...structuredClone(preset.data.stage) };
    p.frames = ph.srcs.map((src, i) => ({ id: `ph${i}`, layers: [imageLayer(src)] }));
    return p;
  }, [ph, preset, cw, ch]);

  const total = project ? projectDuration(project) : 0;
  const still = total * 0.18; // момент, у якому зображення вже на місці, а рух ще помітний

  useEffect(() => {
    if (!project || !ph || !canvasRef.current) return;
    const canvas = canvasRef.current;
    if (!playing) { renderScene(project, still, canvas, ph.assets); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      renderScene(project, ((now - start) / 1000) % total, canvas, ph.assets);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [project, ph, playing, total, still]);

  return <canvas ref={canvasRef} width={cw} height={ch} style={{ width: cw / 2, height: ch / 2 }} aria-hidden />;
}
