import type { Easing, EasingType } from '../model/types';
import { applyEasing } from '../render/easing';
import { SelectRow, SliderRow, useStoredOpen } from './ui';

const OPTIONS: { id: EasingType; label: string }[] = [
  { id: 'linear', label: 'Linear' },
  { id: 'ease-in', label: 'Ease in' },
  { id: 'ease-out', label: 'Ease out' },
  { id: 'ease-in-out', label: 'Ease in-out' },
  { id: 'back', label: 'Back (overshoot)' },
  { id: 'elastic', label: 'Elastic' },
];

function Curve({ easing }: { easing: Easing }) {
  // Back і Elastic виходять за 0–1, тож масштаб графіка підлаштовується під найвищу й найнижчу точку.
  const vals = Array.from({ length: 61 }, (_, i) => applyEasing(easing, i / 60));
  const lo = Math.min(0, ...vals), hi = Math.max(1, ...vals);
  const y = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100;
  const pts = vals.map((v, i) => `${((i / 60) * 100).toFixed(1)},${y(v).toFixed(1)}`);
  return (
    <svg className="curve" viewBox="-2 -2 104 104" preserveAspectRatio="none" aria-label="Speed graph">
      <line x1="0" y1={y(1)} x2="100" y2={y(1)} stroke="var(--line-strong)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      <line x1="0" y1={y(0)} x2="100" y2={y(0)} stroke="var(--line-strong)" vectorEffect="non-scaling-stroke" />
      <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function EasingControls({ value, onChange }: { value: Easing; onChange: (e: Easing) => void }) {
  // Сила кривої й графік рідко потрібні, тому під Advanced (стан пам'ятається).
  const [advanced, setAdvanced] = useStoredOpen('easing-advanced', false);
  return (
    <>
      <SelectRow label="Curve" value={value.type} options={OPTIONS} onChange={(type) => onChange({ ...value, type })} />
      <button className="link" onClick={() => setAdvanced(!advanced)}>{advanced ? 'Hide advanced' : 'Advanced'}</button>
      {advanced && (
        <>
          <SliderRow label="Strength" value={value.strength} min={1} max={6} step={0.5} decimals={1} disabled={value.type === 'linear'}
            onChange={(strength) => onChange({ ...value, strength })} />
          <Curve easing={value} />
        </>
      )}
    </>
  );
}
