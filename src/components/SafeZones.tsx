import { useState } from 'react';
import type { Project, SafeZone } from '../model/types';
import * as A from '../state/projectActions';
import { NumberField, Row, Section } from './ui';

interface Props { project: Project; onChange: (fn: (p: Project) => Project) => void }

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

export function SafeZones({ project, onChange }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const zones = project.canvas.safeZones;
  const patch = (id: string, p: Partial<SafeZone>) => onChange((pr) => A.updateSafeZone(pr, id, p));

  return (
    <Section id="safe" title="Safe zones">
      {zones.map((z) => (
        <div key={z.id} className="zone">
          <div className="zone-head">
            <input type="checkbox" aria-label={`Show ${z.name}`} checked={z.visible} onChange={(e) => patch(z.id, { visible: e.target.checked })} />
            <i className="swatch" style={{ background: z.color }} aria-hidden />
            <span className="zone-name">{z.name}</span>
            {z.source === 'unverified' && <span className="tag">Unverified</span>}
            <button className="link" onClick={() => setEditing(editing === z.id ? null : z.id)}>{editing === z.id ? 'Done' : 'Edit'}</button>
          </div>
          {editing === z.id && (
            <div className="zone-edit">
              <Row label="Name"><input className="txt" value={z.name} maxLength={40} onChange={(e) => patch(z.id, { name: e.target.value })} /></Row>
              {SIDES.map((side) => (
                <Row key={side} label={`${side[0].toUpperCase()}${side.slice(1)}, %`}>
                  <NumberField value={z[side] * 100} min={0} max={49} step={0.5} decimals={1} onChange={(v) => patch(z.id, { [side]: v / 100, source: 'custom' })} />
                </Row>
              ))}
              <Row label="Color"><input type="color" value={z.color} onChange={(e) => patch(z.id, { color: e.target.value })} aria-label="Zone color" /></Row>
              <button className="link" onClick={() => { onChange((pr) => A.removeSafeZone(pr, z.id)); setEditing(null); }}>Delete zone</button>
            </div>
          )}
        </div>
      ))}
      <button onClick={() => onChange((pr) => A.addSafeZone(pr))}>+ Add zone</button>
    </Section>
  );
}
