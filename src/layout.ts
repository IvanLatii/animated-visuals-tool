export interface Layout { left: number; right: number; timeline: number }

export const DEFAULT_LAYOUT: Layout = { left: 220, right: 300, timeline: 100 };
export const LIMITS = { left: [160, 420], right: [240, 560], timeline: [72, 320] } as const;
const KEY = 'av.layout';

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

export function loadLayout(): Layout {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Layout>;
    return {
      left: clamp(Number(raw.left ?? DEFAULT_LAYOUT.left), LIMITS.left),
      right: clamp(Number(raw.right ?? DEFAULT_LAYOUT.right), LIMITS.right),
      timeline: clamp(Number(raw.timeline ?? DEFAULT_LAYOUT.timeline), LIMITS.timeline),
    };
  } catch { return DEFAULT_LAYOUT; }
}

export function saveLayout(layout: Layout) {
  try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch { /* без збереження теж працює */ }
}
