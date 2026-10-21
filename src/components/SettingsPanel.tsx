import { useState } from 'react';
import { resolveFrame } from '../model/defaults';
import type { Project } from '../model/types';
import * as A from '../state/projectActions';
import { MotionControls, TransitionControls } from './AnimationControls';
import { CanvasControls } from './CanvasControls';
import { FitControls } from './FitControls';

interface Props {
  project: Project;
  selectedId: string | null;
  duration: number;
  showSafe: boolean;
  onShowSafe: (v: boolean) => void;
  onChange: (fn: (p: Project) => Project) => void;
}

const MIN = 0.1, MAX = 30;

function DurationInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input type="number" min={MIN} max={MAX} step={0.1} value={value}
      onChange={(e) => {
        const v = e.target.valueAsNumber;
        if (Number.isFinite(v) && v >= MIN && v <= MAX) onChange(v);
      }} />
  );
}

export function SettingsPanel({ project, selectedId, duration, showSafe, onShowSafe, onChange }: Props) {
  const [scope, setScope] = useState<'project' | 'frame'>('project');
  const index = project.frames.findIndex((f) => f.id === selectedId);
  const frame = index >= 0 ? project.frames[index] : null;
  const rf = frame ? resolveFrame(project, frame) : null;
  const editFrame = scope === 'frame' && frame !== null && rf !== null;

  const fitValue = editFrame ? (frame.layers[0]?.fit ?? project.defaults.layerFit) : project.defaults.layerFit;
  const fitOverridden = editFrame && frame.layers.some((l) => l.fit !== undefined);

  return (
    <section className="panel settings">
      <h2>Формат</h2>
      <CanvasControls project={project} showSafe={showSafe} onShowSafe={onShowSafe}
        onPreset={(p) => onChange((pr) => A.setCanvasPreset(pr, p))}
        onSize={(w, h) => onChange((pr) => A.setCanvasSize(pr, w, h))}
        onBackground={(c) => onChange((pr) => A.setBackground(pr, c))}
        onSafeInset={(v) => onChange((pr) => A.setSafeInset(pr, v))} />

      <h2>Анімація</h2>
      <div className="seg-buttons" role="group" aria-label="Для чого налаштування">
        <button className={!editFrame ? 'on' : ''} onClick={() => setScope('project')}>Для всього проєкту</button>
        <button className={editFrame ? 'on' : ''} disabled={!frame} onClick={() => setScope('frame')}
          title={frame ? '' : 'Спершу вибери кадр'}>{frame ? `Тільки кадр ${index + 1}` : 'Тільки кадр'}</button>
      </div>

      {editFrame ? (
        <>
          <label className="field inline"><span>Тривалість кадру, с</span>
            <DurationInput value={rf.duration} onChange={(v) => onChange((pr) => A.setFrameDuration(pr, frame.id, v))} />
          </label>
          {frame.duration !== undefined && (
            <button className="link" onClick={() => onChange((pr) => A.setFrameDuration(pr, frame.id, undefined))}>Скинути тривалість</button>
          )}
          <FitControls value={fitValue} overridden={fitOverridden}
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
          <p className="row"><span>Загальна тривалість</span><b>{duration.toFixed(1)} с</b></p>
          <label className="field inline"><span>Тривалість кадру, с</span>
            <DurationInput value={project.defaults.frameDuration} onChange={(v) => onChange((pr) => A.setDefaultFrameDuration(pr, v))} />
          </label>
          <FitControls value={project.defaults.layerFit} overridden={false}
            onChange={(v) => onChange((pr) => A.setDefaultFit(pr, v))} />
          <MotionControls value={project.defaults.motion} overridden={false}
            onChange={(patch) => onChange((pr) => A.setDefaultMotion(pr, patch))} />
          <TransitionControls value={project.defaults.transitionOut} overridden={false}
            onChange={(patch) => onChange((pr) => A.setDefaultTransition(pr, patch))} />
        </>
      )}
    </section>
  );
}
