import { useRef } from 'react';
import type { Project } from '../model/types';
import { FrameList } from './FrameList';
import { ReplaceIcon, TrashIcon } from './icons';

type Kind = 'background' | 'overlay';

interface Props {
  project: Project;
  selection: string[];
  layerSel: Kind | null;
  onSelectFrame: (id: string, mode: 'single' | 'toggle' | 'range') => void;
  onSelectLayer: (kind: Kind) => void;
  onDeselect: () => void;
  onSelectAll: () => void;
  onPickFiles: (files: FileList) => void;
  onReplace: (id: string, file: File) => void;
  onRemove: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onClear: () => void;
  onPickImage: (kind: Kind, file: File) => void;
  onClearImage: (kind: Kind) => void;
}

/** Рядок шару-картинки (накладка або фон): мініатюра, назва, дії. Додавання картинок — лише тут і в списку кадрів. */
function LayerRow({ kind, project, selected, onSelect, onPick, onClear }: {
  kind: Kind; project: Project; selected: boolean; onSelect: () => void; onPick: (f: File) => void; onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const src = project.stage[kind];
  const name = project.stage[kind === 'background' ? 'backgroundName' : 'overlayName'];
  const label = kind === 'background' ? 'Background' : 'Overlay';
  return (
    <div className="frames-block">
      <header>
        <h2>{label}</h2>
        {!src && <button onClick={() => ref.current?.click()}>+ Add</button>}
      </header>
      {src && (
        <div className={`frame lrow ${selected ? 'selected' : ''}`} onClick={onSelect}>
          <span className="thumb"><img src={src} alt="" /></span>
          <span className="meta"><b className="fname" title={name}>{name || 'image'}</b></span>
          <span className="acts row">
            <button className="icon" data-tip={`Replace ${label.toLowerCase()}`} data-tip-pos="left" aria-label={`Replace ${label.toLowerCase()}`}
              onClick={(e) => { e.stopPropagation(); ref.current?.click(); }}><ReplaceIcon /></button>
            <button className="icon danger" data-tip={`Remove ${label.toLowerCase()}`} data-tip-pos="left" aria-label={`Remove ${label.toLowerCase()}`}
              onClick={(e) => { e.stopPropagation(); onClear(); }}><TrashIcon /></button>
          </span>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
    </div>
  );
}

/** Layers (ліворуч): усе, що є в проєкті. Зверху накладка, посередині кадри-зображення, внизу фон. Клік по порожньому знімає вибір. */
export function LayersPanel(p: Props) {
  return (
    <section className="panel layers" onClick={(e) => { if (!(e.target as Element).closest('.frame, button, a, input')) p.onDeselect(); }}>
      <LayerRow kind="overlay" project={p.project} selected={p.layerSel === 'overlay'} onSelect={() => p.onSelectLayer('overlay')}
        onPick={(f) => p.onPickImage('overlay', f)} onClear={() => p.onClearImage('overlay')} />
      <FrameList project={p.project} selection={p.selection} onSelect={p.onSelectFrame} onSelectAll={p.onSelectAll}
        onRemove={p.onRemove} onMove={p.onMove} onPickFiles={p.onPickFiles} onReplace={p.onReplace} onClear={p.onClear} />
      <LayerRow kind="background" project={p.project} selected={p.layerSel === 'background'} onSelect={() => p.onSelectLayer('background')}
        onPick={(f) => p.onPickImage('background', f)} onClear={() => p.onClearImage('background')} />
    </section>
  );
}
