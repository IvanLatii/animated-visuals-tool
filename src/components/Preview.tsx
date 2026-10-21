import { useEffect, useRef } from 'react';
import type { Project } from '../model/types';
import { renderScene, type Assets } from '../render/renderScene';

interface Props {
  project: Project;
  assets: Assets;
  t: number;
  playing: boolean;
  loop: boolean;
  duration: number;
  onTogglePlay: () => void;
  onToggleLoop: (v: boolean) => void;
}

export function Preview({ project, assets, t, playing, loop, duration, onTogglePlay, onToggleLoop }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { w, h } = project.canvas;

  useEffect(() => {
    if (canvasRef.current) renderScene(project, t, canvasRef.current, assets);
  }, [project, assets, t]);

  const empty = project.frames.length === 0;
  return (
    <section className="preview">
      <div className="stage">
        <canvas ref={canvasRef} width={w} height={h} style={{ aspectRatio: `${w} / ${h}` }} />
        {empty && <div className="empty">Додай картинки, щоб побачити прев'ю</div>}
      </div>
      <div className="transport">
        <button onClick={onTogglePlay} disabled={empty}>{playing ? 'Пауза' : 'Грати'}</button>
        <label><input type="checkbox" checked={loop} onChange={(e) => onToggleLoop(e.target.checked)} /> Повторювати</label>
        <span className="time">{Math.min(t, duration).toFixed(2)} / {duration.toFixed(1)} с</span>
      </div>
    </section>
  );
}
