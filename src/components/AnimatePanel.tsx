import { useState } from 'react';
import { resolveFrame } from '../model/defaults';
import type { Project } from '../model/types';
import * as A from '../state/projectActions';
import { MOTION_PROFILES } from '../model/profiles';
import { MotionControls, TransitionControls } from './AnimationControls';
import { FitControls } from './FitControls';
import { NumberField, Row, Section, SelectRow, Seg, SliderRow } from './ui';

interface Props {
  project: Project;
  selection: string[];
  duration: number;
  onChange: (fn: (p: Project) => Project) => void;
}

export function AnimatePanel({ project, selection, duration, onChange }: Props) {
  const [scope, setScope] = useState<'project' | 'frame'>('project');
  const selectedId = selection[selection.length - 1] ?? null; // для показу беремо останній виділений, зміни йдуть на всіх виділених
  const each = (fn: (p: Project, id: string) => Project) => onChange((pr) => selection.reduce(fn, pr));
  const index = project.frames.findIndex((f) => f.id === selectedId);
  const frame = index >= 0 ? project.frames[index] : null;
  const rf = frame ? resolveFrame(project, frame) : null;
  const editFrame = scope === 'frame' && frame !== null && rf !== null;

  return (
    <>
      <Section id="scope" title="Apply to">
        <Seg label="Apply to" value={editFrame ? 'frame' : 'project'} onChange={setScope} options={[
          { id: 'project', label: 'Whole project' },
          { id: 'frame', label: selection.length > 1 ? `Selected (${selection.length})` : frame ? `Frame ${index + 1}` : 'Frame', disabled: !frame },
        ]} />
        {!editFrame && project.frames.length > 0 && (
          <Row label="Total duration, s">
            <NumberField value={duration} min={project.frames.length * 0.1} max={project.frames.length * 30} step={0.5} decimals={1}
              onChange={(v) => onChange((pr) => A.scaleTotalDuration(pr, v))} />
          </Row>
        )}
      </Section>

      <Section id="anim" title="Animation">
        {editFrame ? (
          <>
            <SliderRow label="Frame duration, s" value={rf.duration} min={0.1} max={10} step={0.1} decimals={1}
              onChange={(v) => each((pr, id) => A.setFrameDuration(pr, id, v))} />
            {frame.duration !== undefined && (
              <button className="link" onClick={() => each((pr, id) => A.setFrameDuration(pr, id, undefined))}>Reset duration</button>
            )}
            <FitControls value={frame.layers[0]?.fit ?? project.defaults.layerFit} overridden={frame.layers.some((l) => l.fit !== undefined)}
              onChange={(v) => each((pr, id) => A.setFrameFit(pr, id, v))}
              onReset={() => each((pr, id) => A.setFrameFit(pr, id, undefined))} />
            <MotionControls value={rf.motion} overridden={frame.motion !== undefined}
              onChange={(patch) => each((pr, id) => A.setFrameMotion(pr, id, patch))}
              onReset={() => each((pr, id) => A.setFrameMotion(pr, id, undefined))} />
            <TransitionControls value={rf.transitionOut} overridden={frame.transitionOut !== undefined}
              onChange={(patch) => each((pr, id) => A.setFrameTransition(pr, id, patch))}
              onReset={() => each((pr, id) => A.setFrameTransition(pr, id, undefined))} />
          </>
        ) : (
          <>
            <SliderRow label="Frame duration, s" value={project.defaults.frameDuration} min={0.1} max={10} step={0.1} decimals={1}
              onChange={(v) => onChange((pr) => A.setDefaultFrameDuration(pr, v))} />
            <FitControls value={project.defaults.layerFit} overridden={false} onChange={(v) => onChange((pr) => A.setDefaultFit(pr, v))} />
            <SelectRow label="Motion profile" value="" onChange={(id) => { const p = MOTION_PROFILES.find((x) => x.id === id); if (p) onChange((pr) => A.applyMotionProfile(pr, p)); }}
              options={[{ id: '', label: 'Apply…' }, ...MOTION_PROFILES.map((p) => ({ id: p.id, label: p.label }))]} />
            <MotionControls value={project.defaults.motion} overridden={false} onChange={(patch) => onChange((pr) => A.setDefaultMotion(pr, patch))} />
            <TransitionControls value={project.defaults.transitionOut} overridden={false} onChange={(patch) => onChange((pr) => A.setDefaultTransition(pr, patch))} />
          </>
        )}
      </Section>
    </>
  );
}
