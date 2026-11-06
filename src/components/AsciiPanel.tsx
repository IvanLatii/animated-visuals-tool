import type { AsciiSettings, Project } from '../model/types';
import { ASCII_DEFAULT, ASCII_PRESETS, resolveAscii } from '../render/ascii';
import * as A from '../state/projectActions';
import { Row, Section, SelectRow, SliderRow, Seg } from './ui';

interface Props {
  project: Project;
  selection: string[];
  onChange: (fn: (p: Project) => Project) => void;
}

/** ASCII-вигляд вибраних кадрів: показує налаштування останнього вибраного, змінює всі вибрані. */
export function AsciiPanel({ project, selection, onChange }: Props) {
  const lastId = selection[selection.length - 1];
  const frame = project.frames.find((f) => f.id === lastId);
  if (!frame) return null;
  const s = resolveAscii(frame.ascii);
  const patch = (p: Partial<AsciiSettings>) => onChange((pr) => selection.reduce((acc, id) => A.setFrameAscii(acc, id, p), pr));
  const on = s.enabled;

  return (
    <Section id="ascii" title={selection.length > 1 ? `ASCII · ${selection.length} selected` : 'ASCII'}
      aside={<input type="checkbox" className="sec-check" checked={on} aria-label="ASCII on" onChange={(e) => patch({ enabled: e.target.checked })} />}>
      <SelectRow label="Style" value="" onChange={(id) => { const p = ASCII_PRESETS.find((x) => x.id === id); if (p) patch({ ...p.settings, enabled: true }); }}
        options={[{ id: '', label: 'Apply preset…' }, ...ASCII_PRESETS.map((p) => ({ id: p.id, label: p.label }))]} />
      <Row label="Shape from" stack>
        <Seg label="Shape from" value={s.source} onChange={(v) => patch({ source: v })} options={[{ id: 'brightness', label: 'Brightness' }, { id: 'alpha', label: 'Alpha' }]} />
      </Row>
      <SliderRow label="Cell size, %" value={s.cell} min={0.005} max={0.04} step={0.0005} scale={100} decimals={1} onChange={(v) => patch({ cell: v })} />
      <SliderRow label="Contrast" value={s.contrast} min={0.3} max={2} step={0.05} decimals={2} onChange={(v) => patch({ contrast: v })} />
      <SliderRow label="Edges" value={s.edges} min={0} max={1} step={0.05} decimals={2} onChange={(v) => patch({ edges: v })} />
      <Row label="Invert"><input type="checkbox" checked={s.invert} onChange={(e) => patch({ invert: e.target.checked })} /></Row>
      <Row label="Characters" stack>
        <input className="hex" style={{ width: '100%' }} value={s.chars} aria-label="Characters, dense to light" spellCheck={false}
          onChange={(e) => patch({ chars: e.target.value || ASCII_DEFAULT.chars })} />
      </Row>
      <Row label="Color" stack>
        <Seg label="Color mode" value={s.colorMode} onChange={(v) => patch({ colorMode: v })} options={[{ id: 'single', label: 'Single' }, { id: 'image', label: 'From image' }]} />
      </Row>
      {s.colorMode === 'single' && (
        <Row label="Symbol color"><input type="color" value={s.color} onChange={(e) => patch({ color: e.target.value })} aria-label="Symbol color" /></Row>
      )}
      <Row label="Background" stack>
        <Seg label="Background" value={s.background === null ? 'none' : 'color'} onChange={(v) => patch({ background: v === 'none' ? null : (s.background ?? '#ffffff') })}
          options={[{ id: 'color', label: 'Color' }, { id: 'none', label: 'Transparent' }]} />
      </Row>
      {s.background !== null && (
        <Row label="Background color"><input type="color" value={s.background} onChange={(e) => patch({ background: e.target.value })} aria-label="Background color" /></Row>
      )}
      {frame.ascii && <button className="link" onClick={() => onChange((pr) => selection.reduce((acc, id) => A.setFrameAscii(acc, id, undefined), pr))}>Remove ASCII</button>}
    </Section>
  );
}
