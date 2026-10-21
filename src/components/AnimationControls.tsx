import type { Motion, MotionType, Transition, TransitionType } from '../model/types';
import { EasingControls } from './EasingControls';

const MOTION_LABELS: Record<MotionType, string> = { none: 'Без руху', 'zoom-in': 'Зум in', 'zoom-out': 'Зум out' };
const TRANSITION_LABELS: Record<TransitionType, string> = { cut: 'Різка зміна', crossfade: 'Crossfade', 'wipe-up': 'Маска знизу вгору' };

interface Common { overridden: boolean; onReset?: () => void }

function Title({ text, overridden, onReset }: { text: string } & Common) {
  return (
    <div className="subhead">
      <h3>{text}{overridden && <em> · змінено для кадру</em>}</h3>
      {overridden && onReset && <button className="link" onClick={onReset}>Скинути</button>}
    </div>
  );
}

export function MotionControls({ value, onChange, overridden, onReset }: { value: Motion; onChange: (p: Partial<Motion>) => void } & Common) {
  return (
    <div className="group">
      <Title text="Рух у кадрі" overridden={overridden} onReset={onReset} />
      <label className="field"><span>Тип</span>
        <select value={value.type} onChange={(e) => onChange({ type: e.target.value as MotionType })}>
          {(Object.keys(MOTION_LABELS) as MotionType[]).map((k) => <option key={k} value={k}>{MOTION_LABELS[k]}</option>)}
        </select>
      </label>
      {value.type !== 'none' && (
        <>
          <label className="field"><span>Сила: {Math.round(value.intensity * 100)}%</span>
            <input type="range" min={0} max={0.6} step={0.01} value={value.intensity}
              onChange={(e) => onChange({ intensity: Number(e.target.value) })} />
          </label>
          <EasingControls value={value.easing} onChange={(easing) => onChange({ easing })} />
        </>
      )}
    </div>
  );
}

export function TransitionControls({ value, onChange, overridden, onReset, isLast }:
  { value: Transition; onChange: (p: Partial<Transition>) => void; isLast?: boolean } & Common) {
  return (
    <div className="group">
      <Title text="Перехід до наступного" overridden={overridden} onReset={onReset} />
      {isLast && <p className="hint">Це останній кадр: переходу після нього немає.</p>}
      <label className="field"><span>Тип</span>
        <select value={value.type} onChange={(e) => onChange({ type: e.target.value as TransitionType })}>
          {(Object.keys(TRANSITION_LABELS) as TransitionType[]).map((k) => <option key={k} value={k}>{TRANSITION_LABELS[k]}</option>)}
        </select>
      </label>
      {value.type !== 'cut' && (
        <>
          <label className="field"><span>Тривалість: {value.duration.toFixed(2)} с</span>
            <input type="range" min={0.05} max={1.5} step={0.05} value={value.duration}
              onChange={(e) => onChange({ duration: Number(e.target.value) })} />
          </label>
          <EasingControls value={value.easing} onChange={(easing) => onChange({ easing })} />
        </>
      )}
    </div>
  );
}
