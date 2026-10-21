// Модель проєкту. Усі позиції й розміри шарів — відносні (0–1), не в пікселях.

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export interface Easing {
  type: EasingType;
  /** Сила кривої: 1 = м'яко, 3 = помітно, 5 = дуже різко. Для linear ігнорується. */
  strength: number;
}

export type MotionType = 'none' | 'zoom-in' | 'zoom-out';
export interface Motion {
  type: MotionType;
  /** На скільки змінюється масштаб: 0.2 = на 20%. */
  intensity: number;
  easing: Easing;
}

export type TransitionType = 'cut' | 'crossfade' | 'wipe-up';
export interface Transition {
  type: TransitionType;
  /** Секунди. Для 'cut' ігнорується. */
  duration: number;
  easing: Easing;
}

export interface ImageLayer {
  type: 'image';
  /** data URL або blob URL. У JSON-файлі проєкту — data URL. */
  src: string;
  x: number; y: number; w: number; h: number; // 0–1
  /** Не задано — береться Defaults.layerFit. */
  fit?: 'fit' | 'fill';
}
export type Layer = ImageLayer; // 'text' | '3d' — пізніше

export interface Frame {
  id: string;
  layers: Layer[];
  // Усе нижче необов'язкове: якщо не задано, береться з Project.defaults.
  duration?: number;
  motion?: Partial<Motion>;
  transitionOut?: Partial<Transition>;
}

export interface Defaults {
  frameDuration: number;
  layerFit: 'fit' | 'fill';
  motion: Motion;
  transitionOut: Transition;
}

export interface SafeZone { top: number; right: number; bottom: number; left: number } // 0–1

export interface Project {
  version: 1;
  canvas: {
    w: number; h: number;
    preset: '1:1' | '4:5' | '16:9' | '9:16' | 'custom';
    background: string;
    safeZone?: SafeZone;
  };
  frames: Frame[];
  defaults: Defaults;
}

// Налаштування експорту. Експорт іде циклом по списку таких завдань.
export interface ExportJob {
  format: 'gif' | 'mp4';
  fps: number;
  /** Множник розміру полотна: 1 = як у проєкті, 0.5 = вдвічі менше. */
  scale: number;
  /** Лише GIF: якість gifski, 1–100 */
  gif?: { quality: number };
  /** Лише MP4: біт/с */
  mp4?: { bitrate: number };
}
