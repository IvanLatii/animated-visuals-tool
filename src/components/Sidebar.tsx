import { useState } from 'react';
import type { ExportSettings } from '../export/presets';
import type { Assets } from '../render/renderScene';
import type { Project } from '../model/types';
import { AsciiPanel } from './AsciiPanel';
import { ClipPanel } from './ClipPanel';
import { FrameLayers } from './FrameLayers';
import { AnimatePanel } from './AnimatePanel';
import { CanvasControls } from './CanvasControls';
import { LayerDesign } from './LayerDesign';
import { Presets } from './Presets';
import { SafeZones } from './SafeZones';
import { SelectionPanel } from './SelectionPanel';
import { StagePanel } from './StagePanel';
import { Section, Tabs } from './ui';
import * as A from '../state/projectActions';

/** Що зараз вибрано в Layers: від цього залежить вміст Inspector. */
export type Target = 'project' | 'frames' | 'background' | 'overlay';
type Tab = 'design' | 'animate';

interface Props {
  project: Project;
  target: Target;
  selection: string[];
  assets: Assets;
  duration: number;
  exportSettings: ExportSettings;
  onChange: (fn: (p: Project) => Project) => void;
  onExportSettings: (s: ExportSettings) => void;
  slot: Omit<React.ComponentProps<typeof StagePanel>, 'project' | 'onChange'>;
  keep: boolean;
  onKeep: (v: boolean) => void;
  frameLayers: { li: number; onSelect: (i: number) => void; onAdd: (id: string, f: File) => void; onRemove: (id: string, i: number) => void; onReplace: (id: string, i: number, f: File) => void; onMove: (id: string, from: number, to: number) => void };
  layer: Pick<React.ComponentProps<typeof LayerDesign>, 'onPickImage' | 'onClearImage'>;
}

/**
 * Inspector — властивості вибраного (як у Figma):
 *  нічого не вибрано → проєкт (формат, вікно, safe-зони, пресети; анімація за замовчуванням);
 *  кадри → зображення (розмір, позиція, поворот) і анімація вибраних;
 *  фон або накладка → їхні властивості.
 * Новий тип шару — це новий рядок у Layers і новий розділ тут, без переносів.
 */
export function Sidebar({ project, target, selection, assets, duration, exportSettings, onChange, onExportSettings, slot, keep, onKeep, layer, frameLayers }: Props) {
  const [tab, setTab] = useState<Tab>('design');
  const isLayer = target === 'background' || target === 'overlay';
  const active: Tab = isLayer ? 'design' : tab; // у шарів-картинок лише одна вкладка
  const tabs: { id: Tab; label: string }[] = isLayer
    ? [{ id: 'design', label: target === 'background' ? 'Background' : 'Overlay' }]
    : [{ id: 'design', label: target === 'frames' ? 'Image' : 'Design' }, { id: 'animate', label: 'Animation' }];

  return (
    <aside className="side">
      <Tabs label="Inspector" value={active} onChange={setTab} options={tabs} />
      <div className="side-scroll">
        {active === 'design' && target === 'frames' && <FrameLayers project={project} selection={selection} li={frameLayers.li} onSelect={frameLayers.onSelect} onAdd={frameLayers.onAdd} onRemove={frameLayers.onRemove} onReplace={frameLayers.onReplace} onMove={frameLayers.onMove} />}
        {active === 'design' && target === 'frames' && <SelectionPanel project={project} selection={selection} assets={assets} onChange={onChange} keep={keep} onKeep={onKeep} li={frameLayers.li} />}
        {active === 'design' && target === 'frames' && <ClipPanel project={project} selection={selection} onChange={onChange} li={frameLayers.li} />}
        {active === 'design' && target === 'frames' && <AsciiPanel project={project} selection={selection} onChange={onChange} />}
        {active === 'design' && isLayer && <LayerDesign project={project} kind={target} assets={assets} onChange={onChange} {...layer} />}
        {active === 'design' && target === 'project' && (
          <>
            <Presets project={project} exportSettings={exportSettings} onChange={onChange} onExportSettings={onExportSettings} />
            <Section id="format" title="Format">
              <CanvasControls project={project}
                onPreset={(p) => onChange((pr) => A.setCanvasPreset(pr, p))}
                onSize={(w, h) => onChange((pr) => A.setCanvasSize(pr, w, h))}
                onBackground={(c) => onChange((pr) => A.setBackground(pr, c))} />
            </Section>
            <StagePanel project={project} onChange={onChange} {...slot} />
            <SafeZones project={project} onChange={onChange} />
          </>
        )}
        {active === 'animate' && <AnimatePanel project={project} selection={selection} scope={target === 'frames' ? 'frame' : 'project'} duration={duration} onChange={onChange} />}
      </div>
    </aside>
  );
}
