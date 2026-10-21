import { useState } from 'react';
import type { Project } from '../model/types';
import { AnimatePanel } from './AnimatePanel';
import { DesignPanel } from './DesignPanel';

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
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="side-scroll">
        {tab === 'design' && <DesignPanel project={project} showSafe={showSafe} onShowSafe={onShowSafe} onChange={onChange} />}
        {tab === 'animate' && <AnimatePanel project={project} selectedId={selectedId} duration={duration} onChange={onChange} />}
      </div>
    </aside>
  );
}
