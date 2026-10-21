import type { Project } from '../model/types';
import { resolveFrame } from '../model/defaults';

interface Props {
  project: Project;
  selectedId: string | null;
  duration: number;
  onDefaultDuration: (d: number) => void;
  onFrameDuration: (id: string, d: number | undefined) => void;
}

const MIN = 0.1, MAX = 30;

function DurationInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input type="number" min={MIN} max={MAX} step={0.1} value={value}
      onChange={(e) => {
        const v = e.target.valueAsNumber;
        if (Number.isFinite(v) && v >= MIN && v <= MAX) onChange(v);
      }} />
  );
}

export function SettingsPanel({ project, selectedId, duration, onDefaultDuration, onFrameDuration }: Props) {
  const index = project.frames.findIndex((f) => f.id === selectedId);
  const frame = index >= 0 ? project.frames[index] : null;
  const rf = frame ? resolveFrame(project, frame) : null;

  return (
    <section className="panel settings">
      <h2>Проєкт</h2>
      <p className="row"><span>Полотно</span><b>{project.canvas.w}×{project.canvas.h}</b></p>
      <p className="row"><span>Загальна тривалість</span><b>{duration.toFixed(1)} с</b></p>
      <label className="row"><span>Тривалість кадру за замовчуванням, с</span>
        <DurationInput value={project.defaults.frameDuration} onChange={onDefaultDuration} />
      </label>

      <h2>{frame ? `Кадр ${index + 1}` : 'Кадр'}</h2>
      {frame && rf ? (
        <>
          <label className="row"><span>Тривалість, с</span>
            <DurationInput value={rf.duration} onChange={(v) => onFrameDuration(frame.id, v)} />
          </label>
          {frame.duration !== undefined && (
            <button onClick={() => onFrameDuration(frame.id, undefined)}>Скинути до значення за замовчуванням</button>
          )}
        </>
      ) : <p className="hint">Вибери кадр у списку або на таймлайні.</p>}
    </section>
  );
}
