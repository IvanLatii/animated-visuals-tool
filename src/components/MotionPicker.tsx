import type { MotionType } from '../model/types';

const ICONS: Record<MotionType, string> = {
  none: 'M4 10h12',
  breathe: 'M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  'zoom-in': 'M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4',
  'zoom-out': 'M8 4v4H4M12 4v4h4M8 16v-4H4M12 16v-4h4',
  'pan-left': 'M16 10H4M8 6l-4 4 4 4',
  'pan-right': 'M4 10h12M12 6l4 4-4 4',
  'pan-up': 'M10 16V4M6 8l4-4 4 4',
  'pan-down': 'M10 4v12M6 12l4 4 4-4',
  'tilt-cw': 'M15 10a5 5 0 1 1-1.5-3.6M15 4v3.5h-3.5',
  'tilt-ccw': 'M5 10a5 5 0 1 0 1.5-3.6M5 4v3.5h3.5',
};
const LABELS: Record<MotionType, string> = {
  none: 'None', breathe: 'Breathe', 'zoom-in': 'Zoom in', 'zoom-out': 'Zoom out', 'pan-left': 'Pan left', 'pan-right': 'Pan right',
  'pan-up': 'Pan up', 'pan-down': 'Pan down', 'tilt-cw': 'Tilt cw', 'tilt-ccw': 'Tilt ccw',
};
const ORDER: MotionType[] = ['none', 'zoom-in', 'zoom-out', 'breathe', 'pan-left', 'pan-right', 'pan-up', 'pan-down', 'tilt-cw', 'tilt-ccw'];

/** Вибір руху плитками: видно, що саме робитиме кожен тип. */
export function MotionPicker({ value, onChange }: { value: MotionType; onChange: (t: MotionType) => void }) {
  return (
    <div className="picker" role="radiogroup" aria-label="Motion type">
      {ORDER.map((t) => (
        <button key={t} type="button" role="radio" aria-checked={t === value} className={t === value ? 'on' : ''} onClick={() => onChange(t)}>
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d={ICONS[t]} /></svg>
          <span>{LABELS[t]}</span>
        </button>
      ))}
    </div>
  );
}
