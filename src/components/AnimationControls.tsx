import type { Motion, Transition, TransitionType } from '../model/types';
import { EasingControls } from './EasingControls';
import { MotionPicker } from './MotionPicker';
import { SelectRow, SliderRow } from './ui';

const TRANSITIONS: { id: TransitionType; label: string }[] = [
  { id: 'cut', label: 'Cut' }, { id: 'crossfade', label: 'Crossfade' }, { id: 'wipe-up', label: 'Wipe up' }, { id: 'wipe-down', label: 'Wipe down' },
  { id: 'stripes', label: 'Stripes' }, { id: 'columns', label: 'Columns' }, { id: 'zoom-dissolve', label: 'Zoom dissolve' }, { id: 'blur-dissolve', label: 'Blur dissolve' },
];

interface Common { overridden: boolean; onReset?: () => void }

export function GroupTitle({ text, overridden, onReset }: { text: string } & Common) {
  return (
    <div className="grp">
      <span>{text}{overridden && <em> · frame override</em>}</span>
      {overridden && onReset && <button className="link" onClick={onReset}>Reset</button>}
    </div>
  );
}

export function MotionControls({ value, onChange, overridden, onReset }: { value: Motion; onChange: (p: Partial<Motion>) => void } & Common) {
  return (
    <div className="group">
      <GroupTitle text="Motion" overridden={overridden} onReset={onReset} />
      <MotionPicker value={value.type} onChange={(type) => onChange({ type })} />
      {value.type !== 'none' && (
        <>
          <SliderRow label="Strength" value={value.intensity} min={0} max={0.6} step={0.01} scale={100} onChange={(intensity) => onChange({ intensity })} />
          <EasingControls value={value.easing} onChange={(easing) => onChange({ easing })} />
        </>
      )}
    </div>
  );
}

export function TransitionControls({ value, onChange, overridden, onReset }:
  { value: Transition; onChange: (p: Partial<Transition>) => void } & Common) {
  return (
    <div className="group">
      <GroupTitle text="Transition to next" overridden={overridden} onReset={onReset} />
      <SelectRow label="Type" value={value.type} options={TRANSITIONS} onChange={(type) => onChange({ type })} />
      {value.type !== 'cut' && (
        <>
          <SliderRow label="Duration, s" value={value.duration} min={0.05} max={1.5} step={0.05} decimals={2} onChange={(duration) => onChange({ duration })} />
          <EasingControls value={value.easing} onChange={(easing) => onChange({ easing })} />
        </>
      )}
    </div>
  );
}
