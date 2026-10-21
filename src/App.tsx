import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { fileToDataUrl, loadImage } from './assets';
import { Sidebar } from './components/Sidebar';
import { FrameList } from './components/FrameList';
import { Preview } from './components/Preview';
import { Resizer } from './components/Resizer';
import { Seg } from './components/ui';
import { DEFAULT_LAYOUT, LIMITS, loadLayout, saveLayout, type Layout } from './layout';
import { Timeline } from './components/Timeline';
import { applyTheme, loadTheme, type Theme } from './theme';
import { newProject } from './model/defaults';
import type { Project } from './model/types';
import { projectDuration, type Assets } from './render/renderScene';
import { addFrames, moveFrame, newFrame, removeFrame, replaceFrameImage } from './state/projectActions';

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');

export function App() {
  const [project, setProject] = useState<Project>(() => newProject('1:1'));
  const [assets, setAssets] = useState<Assets>(() => new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [showSafe, setShowSafe] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [layout, setLayout] = useState<Layout>(loadLayout);
  const tRef = useRef(0);

  const duration = projectDuration(project);

  const seek = useCallback((time: number) => { tRef.current = time; setT(time); }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) { setError('That is not an image. Use PNG, JPG or WebP.'); return; }
    setError(null);
    const loaded: { frame: ReturnType<typeof newFrame>; img: HTMLImageElement }[] = [];
    for (const file of images) {
      try {
        const src = await fileToDataUrl(file);
        loaded.push({ frame: newFrame(src), img: await loadImage(src) });
      } catch {
        setError(`Could not open "${file.name}".`);
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

  const replaceFile = useCallback(async (id: string, file: File) => {
    if (!file.type.startsWith('image/')) { setError('That is not an image. Use PNG, JPG or WebP.'); return; }
    try {
      const src = await fileToDataUrl(file);
      const img = await loadImage(src);
      setAssets((prev) => new Map(prev).set(src, img));
      setProject((p) => replaceFrameImage(p, id, src));
      setError(null);
    } catch {
      setError(`Could not open "${file.name}".`);
    }
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

  const togglePlay = useCallback(() => {
    if (duration <= 0) return;
    if (!playing && tRef.current >= duration) seek(0);
    setPlaying((p) => !p);
  }, [duration, playing, seek]);

  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => { saveLayout(layout); }, [layout]);

  // Space = play/pause, але не коли Іван друкує в полі.
  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['TEXTAREA', 'SELECT'].includes(t.tagName)
      || (t instanceof HTMLInputElement && !['checkbox', 'range', 'button'].includes(t.type)));
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || typing(e.target)) return;
      e.preventDefault();
      togglePlay();
    };
    const onUp = (e: KeyboardEvent) => { if (e.code === 'Space' && !typing(e.target)) e.preventDefault(); }; // щоб Space не «натискав» кнопку у фокусі
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [togglePlay]);

  return (
    <div className={`app ${dropping ? 'dropping' : ''}`}
      style={{ '--lw': `${layout.left}px`, '--rw': `${layout.right}px`, '--th': `${layout.timeline}px` } as CSSProperties}
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); setDropping(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDropping(false); }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        setDropping(false);
        if (e.defaultPrevented) return; // файл кинули на конкретний кадр — його вже замінено
        e.preventDefault();
        void addFiles(e.dataTransfer.files);
      }}>
      <header className="topbar">
        <b className="brand">Animated Visuals</b>
        <span className="spacer" />
        <Seg label="Theme" value={theme} onChange={setTheme} options={[
          { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'system', label: 'Auto' },
        ]} />
      </header>
      <FrameList project={project} selectedId={selectedId}
        onSelect={setSelectedId}
        onRemove={(id) => { setProject((p) => removeFrame(p, id)); setSelectedId((s) => (s === id ? null : s)); }}
        onMove={(from, to) => setProject((p) => moveFrame(p, from, to))}
        onPickFiles={(files) => void addFiles(files)}
        onReplace={(id, file) => void replaceFile(id, file)} />
      <Resizer axis="x" label="Left panel width" value={layout.left} min={LIMITS.left[0]} max={LIMITS.left[1]}
        onChange={(left) => setLayout((l) => ({ ...l, left }))} onReset={() => setLayout((l) => ({ ...l, left: DEFAULT_LAYOUT.left }))} />
      <div className="center">
        <Preview project={project} assets={assets} t={t} showSafe={showSafe} playing={playing} loop={loop} duration={duration}
          onTogglePlay={togglePlay} onToggleLoop={setLoop} />
        <Resizer axis="y" invert label="Timeline height" value={layout.timeline} min={LIMITS.timeline[0]} max={LIMITS.timeline[1]}
          onChange={(timeline) => setLayout((l) => ({ ...l, timeline }))} onReset={() => setLayout((l) => ({ ...l, timeline: DEFAULT_LAYOUT.timeline }))} />
        <Timeline project={project} t={t} selectedId={selectedId} onSeek={seek} onSelect={setSelectedId} />
      </div>
      <Resizer axis="x" invert label="Right panel width" value={layout.right} min={LIMITS.right[0]} max={LIMITS.right[1]}
        onChange={(right) => setLayout((l) => ({ ...l, right }))} onReset={() => setLayout((l) => ({ ...l, right: DEFAULT_LAYOUT.right }))} />
      <Sidebar project={project} assets={assets} selectedId={selectedId} duration={duration}
        showSafe={showSafe} onShowSafe={setShowSafe} onChange={(fn: (p: Project) => Project) => setProject(fn)} />
      {error && <div className="toast" role="alert" onClick={() => setError(null)}>{error}</div>}
    </div>
  );
}
