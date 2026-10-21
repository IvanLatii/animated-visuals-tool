import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { fileToDataUrl, loadImage } from './assets';
import { FrameList } from './components/FrameList';
import { Preview } from './components/Preview';
import { SettingsPanel } from './components/SettingsPanel';
import { Timeline } from './components/Timeline';
import { newProject } from './model/defaults';
import type { Project } from './model/types';
import { projectDuration, type Assets } from './render/renderScene';
import { addFrames, moveFrame, newFrame, removeFrame, setDefaultFrameDuration, setFrameDuration } from './state/projectActions';

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');

export function App() {
  const [project, setProject] = useState<Project>(() => newProject('1:1'));
  const [assets, setAssets] = useState<Assets>(() => new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [dropping, setDropping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tRef = useRef(0);

  const duration = projectDuration(project);

  const seek = useCallback((time: number) => { tRef.current = time; setT(time); }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) { setError('Це не картинки. Підходять PNG, JPG, WebP.'); return; }
    setError(null);
    const loaded: { frame: ReturnType<typeof newFrame>; img: HTMLImageElement }[] = [];
    for (const file of images) {
      try {
        const src = await fileToDataUrl(file);
        loaded.push({ frame: newFrame(src), img: await loadImage(src) });
      } catch {
        setError(`Не вдалося відкрити «${file.name}».`);
      }
    }
    if (loaded.length === 0) return;
    setAssets((prev) => {
      const next = new Map(prev);
      for (const { frame, img } of loaded) next.set(frame.layers[0].src, img);
      return next;
    });
    setProject((p) => addFrames(p, loaded.map((l) => l.frame)));
    setSelectedId(loaded[loaded.length - 1].frame.id);
  }, []);

  // Програвання: рахуємо час від кадру до кадру. Позицію тримаємо в ref, щоб цикл не перестворювався щокадру.
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const next = tRef.current + (now - last) / 1000;
      last = now;
      if (next >= duration) {
        if (loop && duration > 0) seek(next % duration);
        else { seek(duration); setPlaying(false); return; }
      } else seek(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, loop, duration, seek]);

  const togglePlay = () => {
    if (!playing && tRef.current >= duration) seek(0);
    setPlaying((p) => !p);
  };

  return (
    <div className={`app ${dropping ? 'dropping' : ''}`}
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); setDropping(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDropping(false); }}
      onDrop={(e) => { if (hasFiles(e)) { e.preventDefault(); setDropping(false); void addFiles(e.dataTransfer.files); } }}>
      <FrameList project={project} selectedId={selectedId}
        onSelect={setSelectedId}
        onRemove={(id) => { setProject((p) => removeFrame(p, id)); setSelectedId((s) => (s === id ? null : s)); }}
        onMove={(from, to) => setProject((p) => moveFrame(p, from, to))}
        onPickFiles={(files) => void addFiles(files)} />
      <Preview project={project} assets={assets} t={t} playing={playing} loop={loop} duration={duration}
        onTogglePlay={togglePlay} onToggleLoop={setLoop} />
      <SettingsPanel project={project} selectedId={selectedId} duration={duration}
        onDefaultDuration={(d) => setProject((p) => setDefaultFrameDuration(p, d))}
        onFrameDuration={(id, d) => setProject((p) => setFrameDuration(p, id, d))} />
      <Timeline project={project} t={t} selectedId={selectedId} onSeek={seek} onSelect={setSelectedId} />
      {error && <div className="toast" role="alert" onClick={() => setError(null)}>{error}</div>}
    </div>
  );
}
