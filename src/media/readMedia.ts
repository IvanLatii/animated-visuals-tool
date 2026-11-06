import { fileToDataUrl, loadImage } from '../assets';
import type { ClipInfo } from '../model/types';
import type { Asset } from '../render/renderScene';
import { openClip } from './clipAsset';

export interface ReadMedia { src: string; asset: Asset; clip?: ClipInfo }

/** Файл → src (data URL), джерело кадрів і, для відео та анімованого GIF, параметри кліпу. Статичний GIF — звичайна картинка. */
export async function readMedia(file: File): Promise<ReadMedia> {
  const src = await fileToDataUrl(file);
  const opened = await openClip(file, file.type);
  if (opened) {
    return { src, asset: opened.asset, clip: { kind: opened.kind, duration: opened.duration, start: 0, end: opened.duration, speed: 1, loop: true, poster: opened.poster } };
  }
  return { src, asset: await loadImage(src) };
}

export const isMediaFile = (f: File) => f.type.startsWith('image/') || f.type.startsWith('video/');
