import type { Motion, MotionType, Transition, TransitionType } from '../model/types';
import { EasingControls } from './EasingControls';
import { Hint, SelectRow, SliderRow } from './ui';

const MOTIONS: { id: MotionType; label: string }[] = [
  { id: 'none', label: 'Без руху' }, { id: 'zoom-in', label: 'Зум in' }, { id: 'zoom-out', label: 'Зум out' },
];
const TRANSITIONS: { id: TransitionType; label: string }[] = [
  { id: 'cut', label: 'Різка зміна' }, { id: 'crossfade', label: 'Crossfade' }, { id: 'wipe-up', label: 'Маска знизу вгору' },
];

interface Common { overridden: boolean; onReset?: () => void }

export function GroupTitle({ text, overridden, onReset }: { text: string } & Common) {
  return (
    <div className="grp">
      <span>{text}{overridden && <em> · змінено для кадру</em>}</span>
      {overridden && onReset && <button className="link" onClick={onReset}>Скинути</button>}
    </div>
  );
}

export function MotionControls({ value, onChange, overridden, onReset }: { value: Motion; onChange: (p: Partial<Motion>) => void } & Common) {
  return (
    <div className="group">
      <GroupTitle text="Рух у кадрі" overridden={overridden} onReset={onReset} />
      <SelectRow label="Тип" value={value.type} options={MOTIONS} onChange={(type) => onChange({ type })} />
      {value.type !== 'none' && (
        <>
          <SliderRow label="Сила" value={value.intensity} min={0} max={0.6} step={0.01} scale={100} onChange={(intensity) => onChange({ intensity })} />
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
      <GroupTitle text="Перехід до наступного" overridden={overridden} onReset={onReset} />
      {isLast && <Hint>Це останній кадр: переходу після нього немає.</Hint>}
      <SelectRow label="Тип" value={value.type} options={TRANSITIONS} onChange={(type) => onChange({ type })} />
      {value.type !== 'cut' && (
        <>
          <SliderRow label="Тривалість, с" value={value.duration} min={0.05} max={1.5} step={0.05} decimals={2} onChange={(duration) => onChange({ duration })} />
          <EasingControls value={value.easing} onChange={(easing) => onChange({ easing })} />
        </>
      )}
    </div>
  );
}
