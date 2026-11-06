import * as A from '../state/projectActions';
import type { Project } from '../model/types';
import { PauseIcon, PlayIcon, TrashIcon } from './icons';
import { NumberField, Row, Section, SliderRow } from './ui';

interface Props {
  project: Project;
  id: string;
  onChange: (fn: (p: Project) => Project) => void;
  /** Окреме прослуховування цієї доріжки зараз іде. */
  previewing: boolean;
  onPreview: () => void;
  /** Поки кнопка «Original» затиснута, у сцені грає оригінал без налаштувань. */
  onOriginal: (on: boolean) => void;
  onRemove: () => void;
}

const SPEEDS = [0.5, 1, 1.5, 2];

/** Властивості вибраної доріжки звуку. */
export function AudioPanel({ project, id, onChange, previewing, onPreview, onOriginal, onRemove }: Props) {
  const a = (project.audio ?? []).find((x) => x.id === id);
  if (!a) return null;
  const patch = (p: Parameters<typeof A.updateAudio>[2]) => onChange((pr) => A.updateAudio(pr, id, p));
  const len = (a.out - a.in) / a.speed;

  return (
    <>
      <Section id="audio-main" title="Audio">
        <p className="hint" title={a.name}>{a.name} · source {a.duration.toFixed(2)} s · plays {len.toFixed(2)} s</p>
        <div className="btn-row">
          <button onClick={onPreview}>{previewing ? <PauseIcon /> : <PlayIcon />}{previewing ? 'Stop' : 'Play track'}</button>
          <button data-tip="Hold to hear the original, without volume, fades, speed, mute and solo · O" data-tip-pos="top"
            onPointerDown={() => onOriginal(true)} onPointerUp={() => onOriginal(false)} onPointerLeave={() => onOriginal(false)}>Hold: original</button>
        </div>
        <SliderRow label="Volume, %" value={a.volume} min={0} max={2} step={0.05} scale={100} onChange={(volume) => patch({ volume })} />
        <Row label="Mute"><input type="checkbox" checked={a.muted} onChange={(e) => patch({ muted: e.target.checked })} /></Row>
        <Row label="Solo"><input type="checkbox" checked={a.solo} onChange={(e) => patch({ solo: e.target.checked })} /></Row>
        <SliderRow label="Fade in, s" value={a.fadeIn} min={0} max={Math.max(0.1, Math.min(10, len))} step={0.1} decimals={1} onChange={(fadeIn) => patch({ fadeIn })} />
        <SliderRow label="Fade out, s" value={a.fadeOut} min={0} max={Math.max(0.1, Math.min(10, len))} step={0.1} decimals={1} onChange={(fadeOut) => patch({ fadeOut })} />
      </Section>
      <Section id="audio-time" title="Time">
        <Row label="Start on timeline, s"><NumberField value={a.start} min={0} max={600} step={0.1} decimals={2} onChange={(start) => patch({ start })} /></Row>
        <Row label="Trim from, s"><NumberField value={a.in} min={0} max={Math.max(0, a.duration - 0.05)} step={0.1} decimals={2} onChange={(v) => patch({ in: v })} /></Row>
        <Row label="Trim to, s"><NumberField value={a.out} min={0.05} max={a.duration} step={0.1} decimals={2} onChange={(v) => patch({ out: v })} /></Row>
        <SliderRow label="Speed, ×" value={a.speed} min={0.25} max={4} step={0.05} decimals={2} onChange={(speed) => patch({ speed })} />
        <div className="btn-row">{SPEEDS.map((s) => <button key={s} className={Math.abs(a.speed - s) < 1e-6 ? 'on' : ''} onClick={() => patch({ speed: s })}>{s}×</button>)}</div>
        <p className="hint">Speed also changes the pitch.</p>
        <Row label="Loop until the end"><input type="checkbox" checked={a.loop} onChange={(e) => patch({ loop: e.target.checked })} /></Row>
        <button className="link" onClick={() => onChange((p) => A.resetAudio(p, id))}>Reset all audio settings</button>
        <button className="link danger" onClick={onRemove}><TrashIcon /> Remove track</button>
      </Section>
    </>
  );
}
