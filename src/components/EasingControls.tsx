import type { Easing, EasingType } from '../model/types';
import { applyEasing } from '../render/easing';
import { SelectRow, SliderRow } from './ui';

const OPTIONS: { id: EasingType; label: string }[] = [
  { id: 'linear', label: 'Linear' },
  { id: 'ease-in', label: 'Ease in' },
  { id: 'ease-out', label: 'Ease out' },
  { id: 'ease-in-out', label: 'Ease in-out' },
];

function Curve({ easing }: { easing: Easing }) {
  const pts = Array.from({ length: 41 }, (_, i) => {
    const x = i / 40;
    return `${(x * 100).toFixed(1)},${(100 - applyEasing(easing, x) * 100).toFixed(1)}`;
  });
  return (
    <svg className="curve" viewBox="-4 -4 108 108" aria-label="Speed graph">
      <rect x="0" y="0" width="100" height="100" fill="none" stroke="var(--line-strong)" />
      <line x1="0" y1="100" x2="100" y2="0" stroke="var(--line-strong)" strokeDasharray="3 3" />
      <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="3" />
    </svg>
  );
}

export function EasingControls({ value, onChange }: { value: Easing; onChange: (e: Easing) => void }) {
  return (
    <div className="easing">
      <div className="easing-fields">
        <SelectRow label="Curve" value={value.type} options={OPTIONS} onChange={(type) => onChange({ ...value, type })} />
        <SliderRow label="Strength" value={value.strength} min={1} max={6} step={0.5} decimals={1} disabled={value.type === 'linear'}
          onChange={(strength) => onChange({ ...value, strength })} />
      </div>
      <Curve easing={value} />
    </div>
  );
}
