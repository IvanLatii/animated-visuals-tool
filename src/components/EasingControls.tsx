import type { Easing, EasingType } from '../model/types';
import { applyEasing } from '../render/easing';

const LABELS: Record<EasingType, string> = {
  linear: 'Лінійна',
  'ease-in': 'Повільний старт',
  'ease-out': 'Швидкий старт, повільний кінець',
  'ease-in-out': 'Плавний старт і кінець',
};

function Curve({ easing }: { easing: Easing }) {
  const pts = Array.from({ length: 41 }, (_, i) => {
    const x = i / 40;
    return `${(x * 100).toFixed(1)},${(100 - applyEasing(easing, x) * 100).toFixed(1)}`;
  });
  return (
    <svg className="curve" viewBox="-4 -4 108 108" aria-label="Графік швидкості">
      <rect x="0" y="0" width="100" height="100" fill="none" stroke="currentColor" opacity=".2" />
      <line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" opacity=".2" strokeDasharray="3 3" />
      <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="3" />
    </svg>
  );
}

export function EasingControls({ value, onChange }: { value: Easing; onChange: (e: Easing) => void }) {
  return (
    <div className="easing">
      <div className="easing-fields">
        <label className="field"><span>Крива</span>
          <select value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value as EasingType })}>
            {(Object.keys(LABELS) as EasingType[]).map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}
          </select>
        </label>
        <label className="field"><span>Сила: {value.strength.toFixed(1)}</span>
          <input type="range" min={1} max={6} step={0.5} value={value.strength} disabled={value.type === 'linear'}
            onChange={(e) => onChange({ ...value, strength: Number(e.target.value) })} />
        </label>
      </div>
      <Curve easing={value} />
    </div>
  );
}
