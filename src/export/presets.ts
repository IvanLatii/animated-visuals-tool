import type { ExportJob, Project } from '../model/types';
import { exportSize } from './renderFrames';

export type QualityMode = 'max' | 'balanced' | 'small' | 'custom';

export interface ExportSettings {
  format: 'mp4' | 'gif' | 'png';
  fps: number;
  mode: QualityMode;
  scale: number;
  /** Використовується в режимі «Вручну» */
  gifQuality: number;
  mp4Mbps: number;
}

export const DEFAULT_SETTINGS: ExportSettings = { format: 'mp4', fps: 30, mode: 'balanced', scale: 1, gifQuality: 90, mp4Mbps: 4 };

// Біт на піксель на кадр: від нього залежить, скільки «важить» відео при будь-якому розмірі.
export const MP4_BPP = { max: 0.25, balanced: 0.12, small: 0.05 } as const;
export const GIF_QUALITY = { max: 95, balanced: 90, small: 80 } as const;
/** Нижче цього якість GIF помітно падає (смуги на градієнтах), тому «вмістити» глибше не спускається. */
export const GIF_MIN_QUALITY = 80;

export function toJob(project: Project, s: ExportSettings): ExportJob {
  const { w, h } = exportSize(project, s.scale);
  if (s.format === 'png') return { format: 'png', fps: s.fps, scale: s.scale };
  if (s.format === 'mp4') {
    const bitrate = s.mode === 'custom' ? s.mp4Mbps * 1e6 : w * h * s.fps * MP4_BPP[s.mode];
    return { format: 'mp4', fps: s.fps, scale: s.scale, mp4: { bitrate } };
  }
  const quality = s.mode === 'custom' ? s.gifQuality : GIF_QUALITY[s.mode];
  return { format: 'gif', fps: s.fps, scale: s.scale, gif: { quality } };
}

/** Зворотне: з готового завдання робимо налаштування «Вручну», щоб Іван бачив, що саме змінила «вмістити». */
export function settingsFromJob(job: ExportJob, prev: ExportSettings): ExportSettings {
  return {
    ...prev, format: job.format, fps: job.fps, scale: job.scale, mode: 'custom',
    gifQuality: job.gif?.quality ?? prev.gifQuality,
    mp4Mbps: job.mp4 ? Math.round((job.mp4.bitrate / 1e6) * 10) / 10 : prev.mp4Mbps,
  };
}
