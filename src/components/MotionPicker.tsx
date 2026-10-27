import type { MotionType } from '../model/types';
import { useStoredOpen } from './ui';

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
  'drift-ul': 'M15 15L5 5M5 11V5h6',
  'drift-ur': 'M5 15L15 5M9 5h6v6',
  'drift-dl': 'M15 5L5 15M5 9v6h6',
  'drift-dr': 'M5 5l10 10M15 9v6H9',
  appear: 'M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13M10 7v6M7 10h6',
  rise: 'M10 16V5M6 9l4-4 4 4M4 16h12',
  float: 'M3 11c2-5 4-5 6 0s4 5 6 0 2-3 2-3',
  pop: 'M6.5 10a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2',
  focus: 'M10 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8M10 2v3M10 15v3M2 10h3M15 10h3',
  handheld: 'M2.5 10l2-3 2 5 2-6 2 7 2-5 2 4 2-2',
};
const LABELS: Record<MotionType, string> = {
  none: 'None', breathe: 'Breathe', 'zoom-in': 'Zoom in', 'zoom-out': 'Zoom out', 'pan-left': 'Pan left', 'pan-right': 'Pan right',
  'pan-up': 'Pan up', 'pan-down': 'Pan down', 'tilt-cw': 'Tilt cw', 'tilt-ccw': 'Tilt ccw',
  'drift-ul': 'Drift ↖', 'drift-ur': 'Drift ↗', 'drift-dl': 'Drift ↙', 'drift-dr': 'Drift ↘',
  float: 'Float', pop: 'Pop in', focus: 'Focus in', handheld: 'Handheld', appear: 'Appear', rise: 'Rise',
};
// Основні — ті, що найкраще виглядають; решта під «More motions».
const PRIMARY: MotionType[] = ['none', 'zoom-in', 'zoom-out', 'focus', 'appear', 'rise'];
const MORE: MotionType[] = ['pop', 'breathe', 'pan-left', 'pan-right', 'pan-up', 'pan-down', 'tilt-cw', 'tilt-ccw',
  'drift-ul', 'drift-ur', 'drift-dl', 'drift-dr', 'float', 'handheld'];

/** Вибір руху плитками: видно, що саме робитиме кожен тип. */
export function MotionPicker({ value, onChange }: { value: MotionType; onChange: (t: MotionType) => void }) {
  const [more, setMore] = useStoredOpen('motion-more', false);
  const showMore = more || MORE.includes(value); // якщо вибрано рідкісний рух, він має бути видно
  const list = showMore ? [...PRIMARY, ...MORE] : PRIMARY;
  return (
    <>
      <div className="picker" role="radiogroup" aria-label="Motion type">
        {list.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={t === value} className={t === value ? 'on' : ''} onClick={() => onChange(t)}>
            <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d={ICONS[t]} /></svg>
            <span>{LABELS[t]}</span>
          </button>
        ))}
        {Array.from({ length: (4 - (list.length % 4)) % 4 }, (_, i) => <span key={`f${i}`} className="fill" />)}
      </div>
      {!MORE.includes(value) && <button className="link" onClick={() => setMore(!more)}>{more ? 'Fewer motions' : 'More motions'}</button>}
    </>
  );
}
