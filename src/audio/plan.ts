import type { Project } from '../model/types';
import { buildTimeline } from '../render/renderScene';

/** Один фрагмент звуку на таймлайні: і доріжка, і звук відео зводяться до одного вигляду. Час — секунди сцени. */
export interface PlanItem {
  key: string;
  src: string;
  start: number; // коли починається на таймлайні
  until: number; // коли замовкає
  inPt: number; outPt: number; // відрізок джерела
  speed: number;
  loop: boolean;
  volume: number;
  fadeIn: number; fadeOut: number;
}

/**
 * Що грати: доріжки (з mute / solo) і звук відео, якщо він увімкнений у кадрі.
 * original = слухаємо «як було»: без гучності, швидкості, затухань, mute і solo (місце й обрізка лишаються).
 */
export function audioPlan(project: Project, original = false): PlanItem[] {
  const tl = buildTimeline(project);
  const tracks = project.audio ?? [];
  const anySolo = !original && tracks.some((a) => a.solo);
  const items: PlanItem[] = [];
  for (const a of tracks) {
    if (!original && (a.muted || (anySolo && !a.solo))) continue;
    const speed = original ? 1 : a.speed;
    const len = (a.out - a.in) / speed;
    items.push({
      key: a.id, src: a.src, start: a.start, until: !original && a.loop ? Math.max(tl.total, a.start + len) : a.start + len,
      inPt: a.in, outPt: a.out, speed, loop: !original && a.loop,
      volume: original ? 1 : a.volume, fadeIn: original ? 0 : a.fadeIn, fadeOut: original ? 0 : a.fadeOut,
    });
  }
  if (!anySolo) {
    for (const it of tl.items) {
      it.rf.frame.layers.forEach((l, i) => {
        const c = l.clip;
        if (!c || c.kind !== 'video' || !c.sound) return;
        const len = (c.end - c.start) / c.speed;
        items.push({
          key: `${it.rf.frame.id}:${i}`, src: l.src, start: it.start, until: c.loop ? it.end : Math.min(it.end, it.start + len),
          inPt: c.start, outPt: c.end, speed: c.speed, loop: c.loop, volume: 1, fadeIn: 0, fadeOut: 0,
        });
      });
    }
  }
  return items;
}

/** Є хоч щось, що зазвучить в експорті. */
export function hasAudio(project: Project): boolean {
  return audioPlan(project).length > 0;
}
