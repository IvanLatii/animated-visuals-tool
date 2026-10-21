import type { ExportSettings } from './export/presets';
import type { Defaults, Project } from './model/types';

// Пресет — налаштування без картинок і кадрів: формат, тло, safe-зони, значення за замовчуванням (рух, перехід, криві, fit, тривалість) та режим експорту.
export interface PresetData {
  canvas: Pick<Project['canvas'], 'w' | 'h' | 'preset' | 'background' | 'safeZones'>;
  defaults: Defaults;
  export: ExportSettings;
}
export interface Preset { id: string; name: string; data: PresetData }

const KEY = 'av.presets';

export function loadPresets(): Preset[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter(isPreset) : [];
  } catch { return []; }
}

export function storePresets(list: Preset[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* без збереження пресети живуть до перезавантаження */ }
}

function isPreset(p: unknown): p is Preset {
  const x = p as Preset | null;
  return !!x && typeof x.id === 'string' && typeof x.name === 'string' && !!x.data?.canvas && !!x.data.defaults && !!x.data.export;
}

export function makePreset(name: string, project: Project, settings: ExportSettings): Preset {
  const { w, h, preset, background, safeZones } = project.canvas;
  return {
    id: crypto.randomUUID(), name,
    data: structuredClone({ canvas: { w, h, preset, background, safeZones }, defaults: project.defaults, export: settings }),
  };
}

/** Кадри, назва проєкту й перевизначення кадрів лишаються як є. */
export function applyPreset(project: Project, preset: Preset): Project {
  const d = structuredClone(preset.data);
  return { ...project, canvas: { ...project.canvas, ...d.canvas }, defaults: d.defaults };
}

/** Додає або оновлює пресет за назвою. */
export function upsertPreset(list: Preset[], preset: Preset): Preset[] {
  const i = list.findIndex((p) => p.name.toLowerCase() === preset.name.toLowerCase());
  return i < 0 ? [...list, preset] : list.map((p, k) => (k === i ? { ...preset, id: p.id } : p));
}

export function serializePresets(list: Preset[]): string {
  return JSON.stringify({ kind: 'animated-visuals-presets', version: 1, presets: list }, null, 2);
}

export function parsePresets(text: string): Preset[] {
  let data: { kind?: string; presets?: unknown[] };
  try { data = JSON.parse(text); } catch { throw new Error('The file is not valid JSON'); }
  if (data?.kind !== 'animated-visuals-presets' || !Array.isArray(data.presets)) throw new Error('This is not a presets file');
  const ok = data.presets.filter(isPreset);
  if (ok.length === 0) throw new Error('No valid presets in the file');
  return ok;
}
