import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { fileToDataUrl, loadImage } from './assets';
import { Sidebar } from './components/Sidebar';
import { FrameList } from './components/FrameList';
import { Preview } from './components/Preview';
import { Seg } from './components/ui';
import { Timeline } from './components/Timeline';
import { applyTheme, loadTheme, type Theme } from './theme';
import { newProject } from './model/defaults';
import type { Project } from './model/types';
import { projectDuration, type Assets } from './render/renderScene';
import { addFrames, moveFrame, newFrame, removeFrame } from './state/projectActions';

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

  const togglePlay = useCallback(() => {
    if (duration <= 0) return;
    if (!playing && tRef.current >= duration) seek(0);
    setPlaying((p) => !p);
  }, [duration, playing, seek]);

  useEffect(() => { applyTheme(theme); }, [theme]);

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
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); setDropping(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDropping(false); }}
      onDrop={(e) => { if (hasFiles(e)) { e.preventDefault(); setDropping(false); void addFiles(e.dataTransfer.files); } }}>
      <header className="topbar">
        <b className="brand">Animated Visuals</b>
        <span className="spacer" />
        <Seg label="Тема" value={theme} onChange={setTheme} options={[
          { id: 'light', label: 'Світла' }, { id: 'dark', label: 'Темна' }, { id: 'system', label: 'Авто' },
        ]} />
      </header>
      <FrameList project={project} selectedId={selectedId}
        onSelect={setSelectedId}
        onRemove={(id) => { setProject((p) => removeFrame(p, id)); setSelectedId((s) => (s === id ? null : s)); }}
        onMove={(from, to) => setProject((p) => moveFrame(p, from, to))}
        onPickFiles={(files) => void addFiles(files)} />
      <Preview project={project} assets={assets} t={t} showSafe={showSafe} playing={playing} loop={loop} duration={duration}
        onTogglePlay={togglePlay} onToggleLoop={setLoop} />
      <Sidebar project={project} assets={assets} selectedId={selectedId} duration={duration}
        showSafe={showSafe} onShowSafe={setShowSafe} onChange={(fn: (p: Project) => Project) => setProject(fn)} />
      <Timeline project={project} t={t} selectedId={selectedId} onSeek={seek} onSelect={setSelectedId} />
      {error && <div className="toast" role="alert" onClick={() => setError(null)}>{error}</div>}
    </div>
  );
}
