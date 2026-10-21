import type { Project } from '../model/types';
import * as A from '../state/projectActions';
import { CanvasControls } from './CanvasControls';
import { Section } from './ui';

interface Props {
  project: Project;
  showSafe: boolean;
  onShowSafe: (v: boolean) => void;
  onChange: (fn: (p: Project) => Project) => void;
}

export function DesignPanel({ project, showSafe, onShowSafe, onChange }: Props) {
  return (
    <Section id="format" title="Формат">
      <CanvasControls project={project} showSafe={showSafe} onShowSafe={onShowSafe}
        onPreset={(p) => onChange((pr) => A.setCanvasPreset(pr, p))}
        onSize={(w, h) => onChange((pr) => A.setCanvasSize(pr, w, h))}
        onBackground={(c) => onChange((pr) => A.setBackground(pr, c))}
        onSafeInset={(v) => onChange((pr) => A.setSafeInset(pr, v))} />
    </Section>
  );
}
