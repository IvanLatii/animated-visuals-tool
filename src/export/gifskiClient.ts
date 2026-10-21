import { ExportAborted } from './renderFrames';

export function encodeGifski(
  frames: ImageData[], width: number, height: number, fps: number, quality: number, signal?: AbortSignal,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new ExportAborted()); return; }
    const worker = new Worker(new URL('./gifskiWorker.ts', import.meta.url), { type: 'module' });
    const finish = () => { signal?.removeEventListener('abort', onAbort); worker.terminate(); };
    const onAbort = () => { finish(); reject(new ExportAborted()); };
    signal?.addEventListener('abort', onAbort);

    worker.onmessage = (e: MessageEvent<{ ok: true; data: Uint8Array<ArrayBuffer> } | { ok: false; error: string }>) => {
      finish();
      if (e.data.ok) resolve(new Blob([e.data.data], { type: 'image/gif' }));
      else reject(new Error(`Кодування GIF не вдалося: ${e.data.error}`));
    };
    worker.onerror = (e) => { finish(); reject(new Error(`Помилка воркера GIF: ${e.message}`)); };

    const buffers = frames.map((f) => new Uint8Array(f.data.buffer));
    worker.postMessage({ frames: buffers, width, height, fps, quality }, buffers.map((b) => b.buffer));
  });
}
