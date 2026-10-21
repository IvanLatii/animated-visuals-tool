import { useRef, useState } from 'react';
import type { ExportSettings } from '../export/presets';
import type { Project } from '../model/types';
import { applyPreset, loadPresets, makePreset, parsePresets, serializePresets, storePresets, upsertPreset, type Preset } from '../presets';
import { Row, Section, SelectRow } from './ui';

interface Props {
  project: Project;
  exportSettings: ExportSettings;
  onChange: (fn: (p: Project) => Project) => void;
  onExportSettings: (s: ExportSettings) => void;
}

export function Presets({ project, exportSettings, onChange, onExportSettings }: Props) {
  const [presets, setPresets] = useState<Preset[]>(loadPresets);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const update = (list: Preset[]) => { setPresets(list); storePresets(list); };
  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(null), 2500); };

  const save = () => {
    const n = name.trim();
    if (!n) return;
    const exists = presets.some((p) => p.name.toLowerCase() === n.toLowerCase());
    update(upsertPreset(presets, makePreset(n, project, exportSettings)));
    setName('');
    flash(exists ? `Updated “${n}”` : `Saved “${n}”`);
  };

  const apply = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    onChange((pr) => applyPreset(pr, p));
    onExportSettings(structuredClone(p.data.export));
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

  return (
    <Section id="presets" title="Presets">
      {presets.length > 0 && (
        <SelectRow label="Apply preset" value="" onChange={apply} options={[{ id: '', label: 'Choose…' }, ...presets.map((p) => ({ id: p.id, label: p.name }))]} />
      )}
      <Row label="Save current as">
        <input className="txt" value={name} placeholder="Preset name" maxLength={40} aria-label="Preset name"
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
        <button disabled={!name.trim()} onClick={save}>Save</button>
      </Row>
      {msg && <p className="hint">{msg}</p>}
      {presets.map((p) => (
        <div key={p.id} className="zone-head">
          <span className="zone-name">{p.name}</span>
          <button className="link" onClick={() => update(presets.filter((x) => x.id !== p.id))}>Delete</button>
        </div>
      ))}
      <div className="zone-head">
        <button className="link" disabled={presets.length === 0} onClick={exportFile}>Export file</button>
        <button className="link" onClick={() => importRef.current?.click()}>Import file</button>
        <input ref={importRef} type="file" accept=".json,application/json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
      </div>
    </Section>
  );
}
