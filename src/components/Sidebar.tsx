import { useState } from 'react';
import type { ExportSettings } from '../export/presets';
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
  selectedId: string | null;
  duration: number;
  exportSettings: ExportSettings;
  onChange: (fn: (p: Project) => Project) => void;
  onExportSettings: (s: ExportSettings) => void;
}

export function Sidebar({ project, selectedId, duration, exportSettings, onChange, onExportSettings }: Props) {
  const [tab, setTab] = useState<Tab>('design');
  return (
    <aside className="side">
      <Tabs label="Panel" value={tab} onChange={setTab} options={TABS} />
      <div className="side-scroll">
        {tab === 'design' && <DesignPanel project={project} exportSettings={exportSettings} onChange={onChange} onExportSettings={onExportSettings} />}
        {tab === 'animate' && <AnimatePanel project={project} selectedId={selectedId} duration={duration} onChange={onChange} />}
      </div>
    </aside>
  );
}
