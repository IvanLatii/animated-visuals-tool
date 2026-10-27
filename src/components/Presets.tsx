import { useRef, useState } from 'react';
import type { ExportSettings } from '../export/presets';
import type { Project } from '../model/types';
import { applyPreset, findDuplicates, loadPresets, makePreset, parsePresets, presetSignature, serializePresets, STARTER_PRESETS, storePresets, upsertPreset, type Preset } from '../presets';
import { TrashIcon } from './icons';
import { PresetPreview } from './PresetPreview';
import { Row, Section, useStoredOpen } from './ui';

interface Props {
  project: Project;
  exportSettings: ExportSettings;
  onChange: (fn: (p: Project) => Project) => void;
  onExportSettings: (s: ExportSettings) => void;
}

/** «Preset 1», «Preset 2»… — перше вільне. */
const nextName = (list: Preset[]) => {
  const used = new Set(list.map((p) => p.name.toLowerCase()));
  let n = 1;
  while (used.has(`preset ${n}`)) n++;
  return `Preset ${n}`;
};

export function Presets({ project, exportSettings, onChange, onExportSettings }: Props) {
  const [presets, setPresets] = useState<Preset[]>(loadPresets);
  const [name, setName] = useState(() => nextName(loadPresets()));
  const [msg, setMsg] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [info, setInfo] = useStoredOpen('presets-info', false); // довге пояснення за запитом, а не завжди на екрані
  const importRef = useRef<HTMLInputElement>(null);

  const update = (list: Preset[]) => { setPresets(list); storePresets(list); };
  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(null), 2500); };

  const save = () => {
    const n = name.trim();
    if (!n) return;
    const made = makePreset(n, project, exportSettings);
    const twin = [...STARTER_PRESETS, ...presets].find((p) => presetSignature(p) === presetSignature(made));
    if (twin) { flash(`Same as “${twin.name}”, not saved`); return; } // однаковий пресет не дублюємо
    const exists = presets.some((p) => p.name.toLowerCase() === n.toLowerCase());
    const next = upsertPreset(presets, made);
    update(next);
    setName(nextName(next));
    flash(exists ? `Updated “${n}”` : `Saved “${n}”`);
  };

  const dups = findDuplicates(presets);
  const dupIds = presets.filter((p) => dups.has(p.id)).map((p) => p.id);
  const nameTaken = presets.some((p) => p.name.toLowerCase() === name.trim().toLowerCase());

  const apply = (p: Preset) => {
    onChange((pr) => applyPreset(pr, p));
    onExportSettings(structuredClone(p.data.export));
    flash(`Applied “${p.name}”`);
  };

  const exportFile = () => {
    const url = URL.createObjectURL(new Blob([serializePresets(presets)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'animated-visuals-presets.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importFile = async (file: File) => {
    try {
      const incoming = parsePresets(await file.text());
      update(incoming.reduce((list, p) => upsertPreset(list, p), presets));
      flash(`Imported ${incoming.length}`);
    } catch (e) { flash(e instanceof Error ? e.message : 'Could not import'); }
  };

  const pretty = (t: string) => t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, ' ');
  const card = (p: Preset, deletable: boolean) => (
    <div key={p.id} className="preset" role="button" tabIndex={0} aria-label={`Apply preset ${p.name}`}
      onPointerEnter={() => setHover(p.id)} onPointerLeave={() => setHover(null)}
      onClick={() => apply(p)} onKeyDown={(e) => { if (e.key === 'Enter') apply(p); }}>
      <div className="preset-thumb"><PresetPreview preset={p} playing={hover === p.id} /></div>
      {dups.has(p.id) && <span className="dup-tag">Same as {dups.get(p.id)}</span>}
      <div className="preset-info">
        <b title={p.name}>{p.name}</b>
        <span>{p.data.canvas.w}×{p.data.canvas.h} · {pretty(p.data.defaults.motion.type)} · {pretty(p.data.defaults.transitionOut.type)}</span>
      </div>
      {deletable && (
        <button className="icon danger del" aria-label={`Delete preset ${p.name}`} data-tip="Delete preset" data-tip-pos="left"
          onClick={(e) => { e.stopPropagation(); update(presets.filter((x) => x.id !== p.id)); }}><TrashIcon /></button>
      )}
    </div>
  );

  return (
    <Section id="presets" title="Presets">
      <button className="link" aria-expanded={info} onClick={() => setInfo(!info)}>{info ? 'Hide details' : 'What does a preset store?'}</button>
      {info && <p className="hint">A preset stores the format, background colour, content area and the default animation (motion, transition, curves, duration) plus the export mode. It does not store images or per-frame changes. Hover a card to preview it.</p>}
      <div className="preset-grid">
        {STARTER_PRESETS.map((p) => card(p, false))}
        {presets.map((p) => card(p, true))}
        {(STARTER_PRESETS.length + presets.length) % 2 === 1 && <span className="fill" />}
      </div>
      {dupIds.length > 0 && (
        <button className="link danger" onClick={() => { update(presets.filter((p) => !dups.has(p.id))); flash(`Removed ${dupIds.length} duplicate${dupIds.length > 1 ? 's' : ''}`); }}>
          Remove {dupIds.length} duplicate{dupIds.length > 1 ? 's' : ''}
        </button>
      )}
      <Row label="Save current as">
        <input className="txt" value={name} placeholder="Preset name" maxLength={40} aria-label="Preset name"
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
        <button disabled={!name.trim()} onClick={save}>{nameTaken ? 'Update' : 'Save'}</button>
      </Row>
      {msg && <p className="hint">{msg}</p>}
      <div className="zone-head">
        <button className="link" disabled={presets.length === 0} onClick={exportFile}>Export file</button>
        <button className="link" onClick={() => importRef.current?.click()}>Import file</button>
        <input ref={importRef} type="file" accept=".json,application/json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
      </div>
    </Section>
  );
}
