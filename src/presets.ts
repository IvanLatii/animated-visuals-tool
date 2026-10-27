import type { ExportSettings } from './export/presets';
import { DEFAULT_SAFE_ZONES, DEFAULTS } from './model/defaults';
import type { Defaults, Project, Stage } from './model/types';

// Пресет — налаштування без картинок і кадрів: формат, тло, safe-зони, значення за замовчуванням (рух, перехід, криві, fit, тривалість) та режим експорту.
export interface PresetData {
  canvas: Pick<Project['canvas'], 'w' | 'h' | 'preset' | 'background' | 'safeZones'>;
  defaults: Defaults;
  /** Геометрія вікна вмісту (без картинок): зручно для шаблонів під Figma-фон. */
  stage?: Pick<Stage, 'slot' | 'radius' | 'shadow'>;
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
    data: structuredClone({ canvas: { w, h, preset, background, safeZones }, defaults: project.defaults, stage: { slot: project.stage.slot, radius: project.stage.radius, shadow: project.stage.shadow }, export: settings }),
  };
}

/** Кадри, назва проєкту й перевизначення кадрів лишаються як є. */
export function applyPreset(project: Project, preset: Preset): Project {
  const d = structuredClone(preset.data);
  return { ...project, canvas: { ...project.canvas, ...d.canvas }, defaults: d.defaults, stage: d.stage ? { ...project.stage, ...d.stage } : project.stage };
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

// Стартові пресети — для наочності й швидкого старту; їх не можна видалити. Без прив'язки до конкретних соцмереж.
const STARTER_EXPORT: ExportSettings = { format: 'mp4', fps: 30, mode: 'balanced', scale: 1, gifQuality: 90, mp4Mbps: 4 };

const starter = (id: string, name: string, canvas: PresetData['canvas'], defaults: Partial<Defaults>, stage?: PresetData['stage']): Preset => ({
  id: `starter-${id}`, name,
  data: { canvas, defaults: { ...DEFAULTS, ...defaults } as Defaults, stage, export: STARTER_EXPORT },
});

export const STARTER_PRESETS: Preset[] = [
  starter('square-zoom', 'Square · Zoom', { w: 1080, h: 1080, preset: '1:1', background: '#ffffff', safeZones: DEFAULT_SAFE_ZONES },
    { motion: { type: 'zoom-in', intensity: 0.2, easing: { type: 'ease-out', strength: 3 } }, transitionOut: { type: 'crossfade', duration: 0.35, easing: { type: 'ease-in-out', strength: 2 } } }),
  starter('portrait-card', 'Portrait · Card', { w: 1080, h: 1350, preset: '4:5', background: '#ece8e1', safeZones: DEFAULT_SAFE_ZONES },
    { layerFit: 'fill', motion: { type: 'zoom-out', intensity: 0.15, easing: { type: 'ease-out', strength: 3 } }, transitionOut: { type: 'wipe-up', duration: 0.55, easing: { type: 'ease-out', strength: 4 } } },
    { slot: { x: 0.12, y: 0.14, w: 0.76, h: 0.72 }, radius: 0.04, shadow: 0.5 }),
  starter('story-soft', 'Story · Soft', { w: 1080, h: 1920, preset: '9:16', background: '#101012', safeZones: DEFAULT_SAFE_ZONES },
    { motion: { type: 'appear', intensity: 0.2, easing: { type: 'ease-out', strength: 3 } }, transitionOut: { type: 'snap', duration: 0.22, easing: { type: 'ease-out', strength: 4 } } }),
];

const stable = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
};

/** Відбиток налаштувань пресету (без імені й id): однакові відбитки — однакові пресети. */
export const presetSignature = (p: Preset): string => stable(p.data);

/** id пресетів, що повністю повторюють попередній (стартові йдуть першими) → назва того, кого повторюють. */
export function findDuplicates(list: Preset[]): Map<string, string> {
  const seen = new Map<string, string>();
  const dups = new Map<string, string>();
  for (const p of [...STARTER_PRESETS, ...list]) {
    const sig = presetSignature(p);
    const first = seen.get(sig);
    if (first !== undefined) dups.set(p.id, first); else seen.set(sig, p.name);
  }
  return dups;
}
