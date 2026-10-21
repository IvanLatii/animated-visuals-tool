import { useState } from 'react';
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
  showSafe: boolean;
  onShowSafe: (v: boolean) => void;
  onChange: (fn: (p: Project) => Project) => void;
}

export function Sidebar({ project, selectedId, duration, showSafe, onShowSafe, onChange }: Props) {
  const [tab, setTab] = useState<Tab>('design');
  return (
    <aside className="side">
      <Tabs label="Panel" value={tab} onChange={setTab} options={TABS} />
      <div className="side-scroll">
        {tab === 'design' && <DesignPanel project={project} showSafe={showSafe} onShowSafe={onShowSafe} onChange={onChange} />}
        {tab === 'animate' && <AnimatePanel project={project} selectedId={selectedId} duration={duration} onChange={onChange} />}
      </div>
    </aside>
  );
}
