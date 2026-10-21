import { MOTION_EASING } from './defaults';
import type { Motion } from './types';

// Профіль руху — набір кроків, які по колу розкладаються на кадри: 1-й кадр бере 1-й крок, 2-й — 2-й і так далі.
export interface MotionProfile { id: string; label: string; steps: Motion[] }

const m = (type: Motion['type'], intensity: number): Motion => ({ type, intensity, easing: MOTION_EASING });

export const MOTION_PROFILES: MotionProfile[] = [
  { id: 'slow-zoom-in', label: 'Slow zoom in', steps: [m('zoom-in', 0.12)] },
  { id: 'zoom-in-out', label: 'Zoom in / out', steps: [m('zoom-in', 0.2), m('zoom-out', 0.2)] },
  { id: 'ken-burns', label: 'Ken Burns flow', steps: [m('zoom-in', 0.2), m('pan-left', 0.15), m('zoom-out', 0.2), m('pan-right', 0.15)] },
  { id: 'float-tilt', label: 'Float and tilt', steps: [m('tilt-cw', 0.25), m('tilt-ccw', 0.25)] },
  { id: 'static', label: 'Static', steps: [m('none', 0.2)] },
];
