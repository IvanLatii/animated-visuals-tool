import { useState } from 'react';
import { resolveFrame } from '../model/defaults';
import type { Project } from '../model/types';
import * as A from '../state/projectActions';
import { MotionControls, TransitionControls } from './AnimationControls';
import { FitControls } from './FitControls';
import { Row, Section, Seg, SliderRow } from './ui';

interface Props {
  project: Project;
  selectedId: string | null;
  duration: number;
  onChange: (fn: (p: Project) => Project) => void;
}

export function AnimatePanel({ project, selectedId, duration, onChange }: Props) {
  const [scope, setScope] = useState<'project' | 'frame'>('project');
  const index = project.frames.findIndex((f) => f.id === selectedId);
  const frame = index >= 0 ? project.frames[index] : null;
  const rf = frame ? resolveFrame(project, frame) : null;
  const editFrame = scope === 'frame' && frame !== null && rf !== null;

  return (
    <>
      <Section id="scope" title="Область">
        <Seg label="Для чого налаштування" value={editFrame ? 'frame' : 'project'} onChange={setScope} options={[
          { id: 'project', label: 'Весь проєкт' },
          { id: 'frame', label: frame ? `Кадр ${index + 1}` : 'Кадр', disabled: !frame, title: frame ? '' : 'Спершу вибери кадр' },
        ]} />
        {!editFrame && <Row label="Загальна тривалість"><b className="val">{duration.toFixed(1)} с</b></Row>}
      </Section>

      <Section id="anim" title="Анімація">
        {editFrame ? (
          <>
            <SliderRow label="Тривалість кадру, с" value={rf.duration} min={0.1} max={10} step={0.1} decimals={1}
              onChange={(v) => onChange((pr) => A.setFrameDuration(pr, frame.id, v))} />
            {frame.duration !== undefined && (
              <button className="link" onClick={() => onChange((pr) => A.setFrameDuration(pr, frame.id, undefined))}>Скинути тривалість</button>
            )}
            <FitControls value={frame.layers[0]?.fit ?? project.defaults.layerFit} overridden={frame.layers.some((l) => l.fit !== undefined)}
              onChange={(v) => onChange((pr) => A.setFrameFit(pr, frame.id, v))}
              onReset={() => onChange((pr) => A.setFrameFit(pr, frame.id, undefined))} />
            <MotionControls value={rf.motion} overridden={frame.motion !== undefined}
              onChange={(patch) => onChange((pr) => A.setFrameMotion(pr, frame.id, patch))}
              onReset={() => onChange((pr) => A.setFrameMotion(pr, frame.id, undefined))} />
            <TransitionControls value={rf.transitionOut} overridden={frame.transitionOut !== undefined}
              isLast={index === project.frames.length - 1}
              onChange={(patch) => onChange((pr) => A.setFrameTransition(pr, frame.id, patch))}
              onReset={() => onChange((pr) => A.setFrameTransition(pr, frame.id, undefined))} />
          </>
        ) : (
          <>
            <SliderRow label="Тривалість кадру, с" value={project.defaults.frameDuration} min={0.1} max={10} step={0.1} decimals={1}
              onChange={(v) => onChange((pr) => A.setDefaultFrameDuration(pr, v))} />
            <FitControls value={project.defaults.layerFit} overridden={false} onChange={(v) => onChange((pr) => A.setDefaultFit(pr, v))} />
            <MotionControls value={project.defaults.motion} overridden={false} onChange={(patch) => onChange((pr) => A.setDefaultMotion(pr, patch))} />
            <TransitionControls value={project.defaults.transitionOut} overridden={false} onChange={(patch) => onChange((pr) => A.setDefaultTransition(pr, patch))} />
          </>
        )}
      </Section>
    </>
  );
}
