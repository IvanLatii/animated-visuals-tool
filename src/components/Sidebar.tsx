import { useState } from 'react';
import type { ExportSettings } from '../export/presets';
import type { Assets } from '../render/renderScene';
import type { Project } from '../model/types';
import { AnimatePanel } from './AnimatePanel';
import { DesignPanel } from './DesignPanel';
import { Tabs } from './ui';

type Tab = 'design' | 'animate';
const TABS: { id: Tab; label: string }[] = [
  { id: 'design', label: 'Design' }, { id: 'animate', label: 'Animation' },
];

interface Props {
  project: Project;
  selection: string[];
  duration: number;
  exportSettings: ExportSettings;
  onChange: (fn: (p: Project) => Project) => void;
  onExportSettings: (s: ExportSettings) => void;
  stage: React.ComponentProps<typeof DesignPanel>['stage'];
  assets: Assets;
  transform: React.ComponentProps<typeof DesignPanel>['transform'];
}

export function Sidebar({ project, selection, assets, duration, exportSettings, onChange, onExportSettings, stage, transform }: Props) {
  const [tab, setTab] = useState<Tab>('design');
  return (
    <aside className="side">
      <Tabs label="Panel" value={tab} onChange={setTab} options={TABS} />
      <div className="side-scroll">
        {tab === 'design' && <DesignPanel project={project} exportSettings={exportSettings} onChange={onChange} onExportSettings={onExportSettings} stage={stage} selection={selection} assets={assets} transform={transform} />}
        {tab === 'animate' && <AnimatePanel project={project} selection={selection} duration={duration} onChange={onChange} />}
      </div>
    </aside>
  );
}
