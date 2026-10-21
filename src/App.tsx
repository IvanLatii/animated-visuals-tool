import { useEffect, useMemo, useRef, useState } from 'react';
import { demoProject } from './demo';
import { loadAssets, projectDuration, renderScene, type Assets } from './render/renderScene';

// Тонкий каркас: лише прев'ю (play/pause, scrub, loop). Справжній інтерфейс — наступний крок.
export function App() {
  const project = useMemo(demoProject, []);
  const duration = projectDuration(project);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => { loadAssets(project).then(setAssets); }, [project]);

  useEffect(() => {
    if (assets && canvasRef.current) renderScene(project, t, canvasRef.current, assets);
  }, [project, assets, t]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      setT((prev) => (prev + dt) % duration); // loop
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration]);

  return (
    <div style={{ font: '14px system-ui', maxWidth: 520, margin: '24px auto', padding: '0 16px' }}>
      <canvas ref={canvasRef} width={project.canvas.w} height={project.canvas.h}
        style={{ width: '100%', background: '#000', borderRadius: 8 }} />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
        <button onClick={() => setPlaying((p) => !p)}>{playing ? 'Пауза' : 'Грати'}</button>
        <input type="range" min={0} max={duration} step={0.01} value={t} style={{ flex: 1 }}
          onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} />
        <span>{t.toFixed(2)} / {duration.toFixed(1)} с</span>
      </div>
    </div>
  );
}
