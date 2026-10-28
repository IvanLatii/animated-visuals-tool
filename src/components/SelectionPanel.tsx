import type { Project } from '../model/types';
import { alignedOffset, type AlignHow } from '../render/layerGeometry';
import type { Assets } from '../render/renderScene';
import * as A from '../state/projectActions';
import { Row, Section, NumberField, Seg } from './ui';

interface Props {
  project: Project;
  selection: string[];
  assets: Assets;
  onChange: (fn: (p: Project) => Project) => void;
  keep: boolean;
  onKeep: (v: boolean) => void;
  editImage: boolean;
  onEditImage: (v: boolean) => void;
  onSelectAll: () => void;
}

const ALIGN: { how: AlignHow; label: string; path: string }[] = [
  { how: 'left', label: 'Align left', path: 'M2 2v12M5 4h8v3H5zM5 9h5v3H5z' },
  { how: 'hcenter', label: 'Align horizontal center', path: 'M8 2v12M3 4h10v3H3zM5 9h6v3H5z' },
  { how: 'right', label: 'Align right', path: 'M14 2v12M3 4h8v3H3zM6 9h5v3H6z' },
  { how: 'top', label: 'Align top', path: 'M2 2h12M4 5v8h3V5zM9 5v5h3V5z' },
  { how: 'vcenter', label: 'Align vertical center', path: 'M2 8h12M4 3v10h3V3zM9 5v6h3V5z' },
  { how: 'bottom', label: 'Align bottom', path: 'M2 14h12M4 3v8h3V3zM9 6v5h3V6z' },
];

/** Спільне значення виділених зображень або «mixed», якщо вони різні. */
function common(values: number[]): { value: number; mixed: boolean } {
  const first = values[0] ?? 0;
  return { value: first, mixed: values.some((v) => Math.abs(v - first) > 1e-6) };
}

export function SelectionPanel({ project, selection, assets, onChange, keep, onKeep, editImage, onEditImage, onSelectAll }: Props) {
  const frames = project.frames.filter((f) => selection.includes(f.id));
  if (frames.length === 0) {
    return (
      <Section id="selection" title="Selected image">
        <p className="hint">Select images to resize, rotate and align them.</p>
        <button disabled={project.frames.length === 0} onClick={onSelectAll}>Select all images</button>
      </Section>
    );
  }
  const layers = frames.map((f) => f.layers[0]).filter(Boolean);
  const ids = frames.map((f) => f.id);
  const fits = new Set(layers.map((l) => l.fit ?? project.defaults.layerFit));
  const fitValue = fits.size === 1 ? [...fits][0] : ''; // різні — жоден не підсвічено
  const sx = common(layers.map((l) => (l.scaleX ?? 1) * 100));
  const sy = common(layers.map((l) => (l.scaleY ?? 1) * 100));
  const dx = common(layers.map((l) => (l.dx ?? 0) * 100));
  const dy = common(layers.map((l) => (l.dy ?? 0) * 100));
  const rot = common(layers.map((l) => l.rotation ?? 0));

  // Усі вирівнювання — відносно вікна вмісту (Content area): зображення міняються по черзі, тож кожне вирівнюється в тій самій рамці.
  const slotW = project.stage.slot.w * project.canvas.w, slotH = project.stage.slot.h * project.canvas.h;
  const align = (how: AlignHow) => onChange((p) => A.mapLayersOf(p, ids, (l) => {
    const img = assets.get(l.src);
    if (!img) return l;
    return { ...l, ...alignedOffset(l, l.fit ?? p.defaults.layerFit, img, slotW, slotH, how) };
  }));

  return (
    <Section id="selection" title={frames.length > 1 ? `Selected images (${frames.length})` : 'Selected image'}>
      <Seg label="Fit mode" value={fitValue} onChange={(v) => onChange((p) => ids.reduce((acc, id) => A.setFrameFit(acc, id, v as 'fit' | 'fill'), p))}
        options={[{ id: 'fit', label: 'Fit' }, { id: 'fill', label: 'Fill' }]} />
      <Row label="Edit on canvas"><input type="checkbox" checked={editImage} onChange={(e) => onEditImage(e.target.checked)} /></Row>
      <Row label="Width, %"><NumberField value={sx.value} mixed={sx.mixed} min={5} max={800} step={1} decimals={0} onChange={(v) => onChange((p) => A.setLayerScale(p, ids, 'x', v / 100, keep))} /></Row>
      <Row label="Height, %"><NumberField value={sy.value} mixed={sy.mixed} min={5} max={800} step={1} decimals={0} onChange={(v) => onChange((p) => A.setLayerScale(p, ids, 'y', v / 100, keep))} /></Row>
      <Row label="Keep proportions"><input type="checkbox" checked={keep} onChange={(e) => onKeep(e.target.checked)} /></Row>
      <div className="btn-row">
        <button onClick={() => onChange((p) => A.scaleLayers(p, ids, 0.9))}>− 10%</button>
        <button onClick={() => onChange((p) => A.scaleLayers(p, ids, 1.1))}>+ 10%</button>
      </div>
      <Row label="Offset X, %"><NumberField value={dx.value} mixed={dx.mixed} min={-100} max={100} step={1} decimals={1} onChange={(v) => onChange((p) => A.patchLayers(p, ids, { dx: v / 100 }))} /></Row>
      <Row label="Offset Y, %"><NumberField value={dy.value} mixed={dy.mixed} min={-100} max={100} step={1} decimals={1} onChange={(v) => onChange((p) => A.patchLayers(p, ids, { dy: v / 100 }))} /></Row>
      <Row label="Rotation, °"><NumberField value={rot.value} mixed={rot.mixed} min={-180} max={180} step={1} decimals={0} onChange={(v) => onChange((p) => A.patchLayers(p, ids, { rotation: v }))} /></Row>
      <div className="align-row" role="group" aria-label="Align in content area">
        {ALIGN.map((a) => (
          <button key={a.how} className="icon" aria-label={a.label} data-tip={a.label} data-tip-pos="top" onClick={() => align(a.how)}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden><path d={a.path} /></svg>
          </button>
        ))}
      </div>
      <button className="link" onClick={() => onChange((p) => A.resetLayerTransform(p, ids))}>Reset size, position and rotation</button>
    </Section>
  );
}
