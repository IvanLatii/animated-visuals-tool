import { clipLength } from '../model/defaults';
import type { Project } from '../model/types';
import * as A from '../state/projectActions';
import { NumberField, Row, Section, SliderRow } from './ui';

interface Props {
  project: Project;
  selection: string[];
  onChange: (fn: (p: Project) => Project) => void;
  li: number;
}

const SPEEDS = [0.5, 1, 2, 4];

/** Відео або GIF у вибраному кадрі: обрізання, швидкість, повтор. Показується лише для кадрів із кліпом. */
export function ClipPanel({ project, selection, onChange, li }: Props) {
  const frame = project.frames.find((f) => f.id === selection[selection.length - 1]);
  const clip = frame?.layers[Math.min(li, (frame?.layers.length ?? 1) - 1)]?.clip;
  if (!frame || !clip) return null;
  const patch = (p: Parameters<typeof A.setClip>[2]) => onChange((pr) => A.setClip(pr, selection, p, li));

  return (
    <Section id="clip" title={clip.kind === 'gif' ? 'GIF clip' : 'Video clip'}>
      <p className="hint">Source {clip.duration.toFixed(2)} s · plays {clipLength(clip).toFixed(2)} s</p>
      <Row label="Start, s"><NumberField value={clip.start} min={0} max={Math.max(0, clip.duration - 0.05)} step={0.1} decimals={2} onChange={(v) => patch({ start: v })} /></Row>
      <Row label="End, s"><NumberField value={clip.end} min={0.05} max={clip.duration} step={0.1} decimals={2} onChange={(v) => patch({ end: v })} /></Row>
      <SliderRow label="Speed, ×" value={clip.speed} min={0.25} max={4} step={0.05} decimals={2} onChange={(v) => patch({ speed: v })} />
      <div className="btn-row">
        {SPEEDS.map((s) => <button key={s} className={Math.abs(clip.speed - s) < 1e-6 ? 'on' : ''} onClick={() => patch({ speed: s })}>{s}×</button>)}
      </div>
      <Row label="Loop"><input type="checkbox" checked={clip.loop} onChange={(e) => patch({ loop: e.target.checked })} /></Row>
    </Section>
  );
}
