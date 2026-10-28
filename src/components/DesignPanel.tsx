import type { Project } from '../model/types';
import * as A from '../state/projectActions';
import { CanvasControls } from './CanvasControls';
import type { ExportSettings } from '../export/presets';
import { Presets } from './Presets';
import { SafeZones } from './SafeZones';
import { SelectionPanel } from './SelectionPanel';
import { StagePanel } from './StagePanel';
import type { Assets } from '../render/renderScene';
import { Section } from './ui';

interface Props {
  project: Project;
  exportSettings: ExportSettings;
  onChange: (fn: (p: Project) => Project) => void;
  onExportSettings: (s: ExportSettings) => void;
  stage: Omit<React.ComponentProps<typeof StagePanel>, 'project' | 'onChange'>;
  selection: string[];
  assets: Assets;
  transform: Pick<React.ComponentProps<typeof SelectionPanel>, 'keep' | 'onKeep' | 'editImage' | 'onEditImage'>;
}

export function DesignPanel({ project, exportSettings, onChange, onExportSettings, stage, selection, assets, transform }: Props) {
  return (
    <>
      <SelectionPanel project={project} selection={selection} assets={assets} onChange={onChange} {...transform} />
      <Presets project={project} exportSettings={exportSettings} onChange={onChange} onExportSettings={onExportSettings} />
      <Section id="format" title="Format">
        <CanvasControls project={project}
          onPreset={(p) => onChange((pr) => A.setCanvasPreset(pr, p))}
          onSize={(w, h) => onChange((pr) => A.setCanvasSize(pr, w, h))}
          onBackground={(c) => onChange((pr) => A.setBackground(pr, c))} />
      </Section>
      <StagePanel project={project} onChange={onChange} {...stage} />
      <SafeZones project={project} onChange={onChange} />
    </>
  );
}
