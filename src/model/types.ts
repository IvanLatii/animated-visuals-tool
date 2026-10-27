// Модель проєкту. Усі позиції й розміри шарів — відносні (0–1), не в пікселях.

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'back' | 'elastic'; // back і elastic виходять за 1 (перельот)

export interface Easing {
  type: EasingType;
  /** Сила кривої: 1 = м'яко, 3 = помітно, 5 = дуже різко. Для linear ігнорується. */
  strength: number;
}

export type MotionType =
  | 'none' | 'zoom-in' | 'zoom-out' | 'breathe' // breathe — наближення й повернення, добре в циклі
  | 'drift-ul' | 'drift-ur' | 'drift-dl' | 'drift-dr' // наближення з діагональним зсувом (куди їде картинка)
  | 'float' | 'pop' | 'focus' | 'handheld'
  | 'appear' | 'rise' // м'яке з'явлення: з прозорості й легкого масштабу / знизу вгору
  | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down' // картинка їде в названий бік
  | 'tilt-cw' | 'tilt-ccw'; // легкий нахил за / проти годинникової стрілки
export interface Motion {
  type: MotionType;
  /** На скільки змінюється масштаб: 0.2 = на 20%. */
  intensity: number;
  easing: Easing;
}

export type TransitionType = 'cut' | 'crossfade' | 'wipe-up' | 'wipe-down' | 'stripes' | 'stripes-alt' | 'snap' | 'columns' | 'zoom-dissolve' | 'blur-dissolve';
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

/** Відступи від країв у частках полотна (0–1). Зон може бути кілька, кожну видно або приховано окремо. */
export interface SafeZone {
  id: string;
  name: string;
  color: string;
  top: number; right: number; bottom: number; left: number;
  visible: boolean;
  /** unverified — цифри зі сторонніх джерел; custom — відступи задає сам користувач. */
  source: 'unverified' | 'custom';
  /** Звідки цифри: показується в редагуванні зони. */
  note?: string;
}

export interface Rect { x: number; y: number; w: number; h: number } // частки полотна 0–1

/** Сцена «бутербродом»: фон під усім, вікно з кадрами посередині, накладка зверху. */
export interface Stage {
  /** src картинки фону (data URL); не задано — лише колір. */
  background?: string;
  /** src накладки (PNG із прозорим отвором, рамка пристрою тощо). */
  overlay?: string;
  /** Де грають кадри. За замовчуванням — усе полотно. */
  slot: Rect;
  /** Радіус кутів вікна, частка ширини полотна. */
  radius: number;
  /** Тінь вікна 0–1. */
  shadow: number;
}

export interface Project {
  version: 1;
  /** Назва проєкту: показується зверху й іде в ім'я файлу. */
  name?: string;
  canvas: {
    w: number; h: number;
    preset: '1:1' | '4:5' | '16:9' | '9:16' | 'custom';
    background: string;
    safeZones: SafeZone[];
  };
  frames: Frame[];
  defaults: Defaults;
  stage: Stage;
}

// Налаштування експорту. Експорт іде циклом по списку таких завдань.
export interface ExportJob {
  format: 'gif' | 'mp4' | 'png';
  fps: number;
  /** Множник розміру полотна: 1 = як у проєкті, 0.5 = вдвічі менше. */
  scale: number;
  /** Лише GIF: якість gifski, 1–100 */
  gif?: { quality: number };
  /** Лише MP4: біт/с */
  mp4?: { bitrate: number };
}
