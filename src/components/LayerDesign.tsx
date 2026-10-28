import { useRef } from 'react';
import type { Project } from '../model/types';
import type { Assets } from '../render/renderScene';
import { setCanvasSize } from '../state/projectActions';
import { Row, Section } from './ui';

interface Props {
  project: Project;
  kind: 'background' | 'overlay';
  assets: Assets;
  onPickImage: (kind: 'background' | 'overlay', file: File) => void;
  onClearImage: (kind: 'background' | 'overlay') => void;
  onChange: (fn: (p: Project) => Project) => void;
}

/** Властивості вибраного шару-картинки (фон або накладка). */
export function LayerDesign({ project, kind, assets, onPickImage, onClearImage, onChange }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const src = project.stage[kind];
  const name = project.stage[kind === 'background' ? 'backgroundName' : 'overlayName'];
  const img = src ? assets.get(src) : undefined;
  const title = kind === 'background' ? 'Background' : 'Overlay';

  const matchCanvas = () => {
    if (!img) return;
    const k = Math.min(1, 4096 / Math.max(img.width, img.height)); // полотно до 4096 px, пропорції зберігаються
    onChange((p) => setCanvasSize(p, img.width * k, img.height * k));
  };

  return (
    <Section id={`layer-${kind}`} title={title}>
      {src ? (
        <>
          <div className="layer-preview"><img src={src} alt="" /></div>
          <Row label="File"><b className="val" title={name}>{name || title}</b></Row>
          {img && <Row label="Size, px"><b className="val">{img.width}×{img.height}</b></Row>}
          <button onClick={() => ref.current?.click()}>Replace image</button>
          {kind === 'background' && <button onClick={matchCanvas}>Match canvas to this image</button>}
          <button className="danger" onClick={() => onClearImage(kind)}>Remove {title.toLowerCase()}</button>
        </>
      ) : (
        <>
          <p className="hint">{kind === 'background' ? 'A picture behind the images. The canvas takes its size.' : 'A picture on top of the images, for example a device frame with a transparent screen.'}</p>
          <button className="primary" onClick={() => ref.current?.click()}>Choose image</button>
        </>
      )}
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickImage(kind, f); e.target.value = ''; }} />
    </Section>
  );
}
