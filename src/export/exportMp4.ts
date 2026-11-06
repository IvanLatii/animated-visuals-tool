import { AudioBufferSource, BufferTarget, CanvasSource, canEncodeAudio, canEncodeVideo, Mp4OutputFormat, Output, Quality } from 'mediabunny';
import { renderMix } from '../audio/audio';
import { audioPlan } from '../audio/plan';
import type { ExportJob, Project } from '../model/types';
import { prepareClips, projectDuration, renderScene, type Assets } from '../render/renderScene';
import type { ExportOptions } from './exportGif';
import { exportSize, frameCount, throwIfAborted } from './renderFrames';

export async function exportMp4(project: Project, job: ExportJob, assets: Assets, opts: ExportOptions = {}): Promise<Blob> {
  const { signal, onStatus } = opts;
  const size = exportSize(project, job.scale, 'mp4');
  const canvas = document.createElement('canvas');
  canvas.width = size.w; canvas.height = size.h;

  const bitrate = Math.min(100e6, Math.max(1000, Math.round(job.mp4?.bitrate ?? 4e6))); // 100 Мбіт/с — стеля, вище кодувальники не беруть
  if (!(await canEncodeVideo('avc', { width: size.w, height: size.h, bitrate, frameRate: job.fps }))) {
    throw new Error(`This browser cannot encode MP4 at ${size.w}×${size.h}, ${job.fps} fps, ${(bitrate / 1e6).toFixed(0)} Mbit/s. Try a lower FPS or bitrate, a smaller size, or GIF.`);
  }
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec: 'avc', quality: new Quality({ bitrate }) });
  output.addVideoTrack(source, { frameRate: job.fps });

  // Звук: змішуємо всі доріжки (і звук відео, якщо ввімкнений) в один буфер і кодуємо в AAC.
  let audioSource: AudioBufferSource | null = null;
  let mix: AudioBuffer | null = null;
  if (job.audio !== false) {
    onStatus?.('Mixing audio', 0);
    mix = await renderMix(audioPlan(project), projectDuration(project));
    if (mix) {
      const cfg = { numberOfChannels: 2, sampleRate: mix.sampleRate, bitrate: 192e3 };
      if (!(await canEncodeAudio('aac', cfg))) throw new Error('This browser cannot encode AAC audio. Turn off "Include audio" to export without sound.');
      audioSource = new AudioBufferSource({ codec: 'aac', bitrate: 192e3 });
      output.addAudioTrack(audioSource);
    }
  }
  await output.start();
  const audioDone = audioSource && mix ? audioSource.add(mix) : null; // звук додаємо паралельно з відео, щоб не чекати одне одного

  const n = frameCount(project, job.fps);
  try {
    for (let f = 0; f < n; f++) {
      throwIfAborted(signal);
      await prepareClips(project, f / job.fps, assets);
      renderScene(project, f / job.fps, canvas, assets);
      await source.add(f / job.fps, 1 / job.fps);
      onStatus?.('Encoding MP4', (f + 1) / n);
    }
    source.close();
    await audioDone;
    audioSource?.close();
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => undefined);
    throw e;
  }
  return new Blob([output.target.buffer!], { type: 'video/mp4' });
}
