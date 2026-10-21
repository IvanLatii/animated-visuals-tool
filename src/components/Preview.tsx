import { useEffect, useRef, type CSSProperties } from 'react';
import type { Project } from '../model/types';
import { renderScene, type Assets } from '../render/renderScene';

interface Props {
  project: Project;
  assets: Assets;
  t: number;
  showSafe: boolean;
  playing: boolean;
  loop: boolean;
  duration: number;
  onTogglePlay: () => void;
  onToggleLoop: (v: boolean) => void;
}

export function Preview({ project, assets, t, showSafe, playing, loop, duration, onTogglePlay, onToggleLoop }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { w, h } = project.canvas;
  const safe = project.canvas.safeZone ?? { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 };

  useEffect(() => {
    if (canvasRef.current) renderScene(project, t, canvasRef.current, assets);
  }, [project, assets, t]);

  const empty = project.frames.length === 0;
  return (
    <section className="preview">
      <div className="stage">
        <div className="canvas-wrap" style={{ '--ar': w / h } as CSSProperties}>
          <canvas ref={canvasRef} width={w} height={h} />
          {showSafe && safe && (
            <div className="safe-zone" style={{ inset: `${safe.top * 100}% ${safe.right * 100}% ${safe.bottom * 100}% ${safe.left * 100}%` }} />
          )}
        </div>
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
