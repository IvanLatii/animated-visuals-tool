import { setSlot, setStageStyle, fitSlotToImage } from '../state/projectActions';
import type { Project } from '../model/types';
import { Section, NumberField, Row, SliderRow, CheckRow } from './ui';

interface Props {
  project: Project;
  /** Розмір картинки вибраного кадру (для «Fit to image»). */
  selectedImage: { w: number; h: number } | null;
  editSlot: boolean;
  onEditSlot: (v: boolean) => void;
  onChange: (fn: (p: Project) => Project) => void;
}

export function StagePanel({ project, selectedImage, editSlot, onEditSlot, onChange }: Props) {
  const { stage } = project;
  const pct = (v: number) => Math.round(v * 1000) / 10;
  const field = (label: string, key: 'x' | 'y' | 'w' | 'h') => (
    <Row label={label}>
      <NumberField value={pct(stage.slot[key])} min={0} max={100} step={0.5} decimals={1}
        onChange={(v) => onChange((p) => setSlot(p, { [key]: v / 100 }))} />
    </Row>
  );
  return (
    <>
      <Section id="slot" title="Content area">
        <CheckRow label="Edit on canvas" checked={editSlot} onChange={onEditSlot} />
        {field('X, %', 'x')}
        {field('Y, %', 'y')}
        {field('Width, %', 'w')}
        {field('Height, %', 'h')}
        <SliderRow label="Corner radius, %" value={stage.radius} min={0} max={0.15} step={0.005} scale={100} decimals={1}
          onChange={(radius) => onChange((p) => setStageStyle(p, { radius }))} />
        <SliderRow label="Shadow" value={stage.shadow} min={0} max={1} step={0.05} scale={100}
          onChange={(shadow) => onChange((p) => setStageStyle(p, { shadow }))} />
        <button disabled={!selectedImage} onClick={() => selectedImage && onChange((p) => fitSlotToImage(p, selectedImage.w, selectedImage.h))}>Fit to image proportions</button>
        <button onClick={() => onChange((p) => setSlot(p, { x: 0, y: 0, w: 1, h: 1 }))}>Reset to full canvas</button>
      </Section>
    </>
  );
}
