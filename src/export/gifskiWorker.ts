import encode from 'gifski-wasm';

// Кодування GIF у окремому потоці: інтерфейс не завмирає, а скасування = terminate() воркера.
interface Request { frames: Uint8Array[]; width: number; height: number; fps: number; quality: number }

const post = (msg: unknown, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(msg, transfer);

self.onmessage = async (e: MessageEvent<Request>) => {
  const { frames, width, height, fps, quality } = e.data;
  try {
    // resizeWidth/Height обов'язкові: без них gifski-wasm вдвічі зменшує картинку.
    const out = await encode({ frames, width, height, fps, quality, resizeWidth: width, resizeHeight: height });
    post({ ok: true, data: out }, [out.buffer]);
  } catch (err) {
    post({ ok: false, error: String(err) });
  }
};
