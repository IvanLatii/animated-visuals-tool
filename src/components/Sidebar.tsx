import { useState } from 'react';
import type { Project } from '../model/types';
import type { Assets } from '../render/renderScene';
import { AnimatePanel } from './AnimatePanel';
import { DesignPanel } from './DesignPanel';
import { ExportPanel } from './ExportPanel';

type Tab = 'design' | 'animate' | 'export';
const TABS: { id: Tab; label: string }[] = [
  { id: 'design', label: 'Design' }, { id: 'animate', label: 'Animation' }, { id: 'export', label: 'Export' },
];

interface Props {
  project: Project;
  assets: Assets;
  selectedId: string | null;
  duration: number;
  showSafe: boolean;
  onShowSafe: (v: boolean) => void;
  onChange: (fn: (p: Project) => Project) => void;
}

export function Sidebar({ project, assets, selectedId, duration, showSafe, onShowSafe, onChange }: Props) {
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
        {/* Експорт лишається змонтованим, щоб не губити результат і хід роботи при перемиканні вкладок */}
        <div hidden={tab !== 'export'}><ExportPanel project={project} assets={assets} /></div>
      </div>
    </aside>
  );
}
