import { useEffect, useRef } from 'react';
import { getBuffer, peaksOf } from '../audio/audio';
import type { AudioTrack } from '../model/types';

/** Хвиля звуку доріжки: показує обрізаний відрізок [in, out], за швидкості й повтору розтягується разом із доріжкою. laneSec — довжина смуги на таймлайні. */
export function Waveform({ track, laneSec }: { track: AudioTrack; laneSec: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let dead = false;
    const draw = async () => {
      const buf = await getBuffer(track.src);
      if (dead || !buf) return;
      const W = Math.max(1, Math.round(cv.clientWidth * devicePixelRatio)), H = Math.max(1, Math.round(cv.clientHeight * devicePixelRatio));
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d')!;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = getComputedStyle(cv).color;
      const peaks = peaksOf(buf);
      const L = Math.max(0.01, track.out - track.in);
      for (let x = 0; x < W; x++) {
        const tau = (x / W) * laneSec; // секунди від початку смуги
        let s = tau * track.speed;
        if (s >= L && !track.loop) break;
        s = track.in + (s % L);
        const v = peaks[Math.min(peaks.length - 1, Math.floor((s / buf.duration) * peaks.length))] ?? 0;
        const h = Math.max(1, v * H * 0.9);
        ctx.fillRect(x, (H - h) / 2, 1, h);
      }
    };
    void draw();
    const ro = new ResizeObserver(() => void draw());
    ro.observe(cv);
    return () => { dead = true; ro.disconnect(); };
  }, [track.src, track.in, track.out, track.speed, track.loop, laneSec]);
  return <canvas ref={ref} className="wave" />;
}
