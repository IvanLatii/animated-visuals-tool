import type { Layer } from '../model/types';

/** Розмір і центр шару у пікселях вікна ДО власного перетворення (розтягування, зсуву, повороту). */
export function baseBox(layer: Layer, fit: 'fit' | 'fill', img: { width: number; height: number }, W: number, H: number) {
  const rx = layer.x * W, ry = layer.y * H, rw = layer.w * W, rh = layer.h * H;
  const k = fit === 'fill' ? Math.max(rw / img.width, rh / img.height) : Math.min(rw / img.width, rh / img.height);
  const w = img.width * k, h = img.height * k;
  return { rx, ry, rw, rh, w, h, cx: rx + rw / 2, cy: ry + rh / 2, vw: fit === 'fill' ? rw : w, vh: fit === 'fill' ? rh : h };
}

export type AlignHow = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

/** Новий зсув (у частках вікна), щоб видима область зображення (з урахуванням розтягування й повороту) торкнулась краю вікна або стала по центру. */
export function alignedOffset(layer: Layer, fit: 'fit' | 'fill', img: { width: number; height: number }, W: number, H: number, how: AlignHow) {
  const b = baseBox(layer, fit, img, W, H);
  const sw = b.vw * (layer.scaleX ?? 1), sh = b.vh * (layer.scaleY ?? 1);
  const a = ((layer.rotation ?? 0) * Math.PI) / 180;
  const bw = sw * Math.abs(Math.cos(a)) + sh * Math.abs(Math.sin(a));
  const bh = sw * Math.abs(Math.sin(a)) + sh * Math.abs(Math.cos(a));
  let dx = layer.dx ?? 0, dy = layer.dy ?? 0;
  if (how === 'left') dx = (bw / 2 - b.cx) / W;
  else if (how === 'right') dx = (W - bw / 2 - b.cx) / W;
  else if (how === 'hcenter') dx = (W / 2 - b.cx) / W;
  else if (how === 'top') dy = (bh / 2 - b.cy) / H;
  else if (how === 'bottom') dy = (H - bh / 2 - b.cy) / H;
  else dy = (H / 2 - b.cy) / H;
  return { dx, dy };
}
