import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { fileToDataUrl, loadImage } from './assets';
import { ExportPanel } from './components/ExportPanel';
import { Sidebar } from './components/Sidebar';
import { FrameList } from './components/FrameList';
import { Preview } from './components/Preview';
import { Resizer } from './components/Resizer';
import { Seg } from './components/ui';
import { DEFAULT_LAYOUT, LIMITS, loadLayout, saveLayout, type Layout } from './layout';
import { Timeline } from './components/Timeline';
import { applyTheme, loadTheme, type Theme } from './theme';
import { DEFAULT_SETTINGS, type ExportSettings } from './export/presets';
import { newProject } from './model/defaults';
import type { Project } from './model/types';
import { parseProject, projectFileName, serializeProject } from './model/projectFile';
import { canPick, downloadText, isAbort, pickOpenHandle, pickSaveHandle, writeHandle, type FileHandle } from './projectIO';
import { buildTimeline, loadAssets, projectDuration, type Assets } from './render/renderScene';
import { addFrames, moveFrame, newFrame, removeFrame, replaceFrameImage, setFrameDuration, setProjectName } from './state/projectActions';

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');

/** Чи Іван зараз друкує. strict = true: будь-яке поле вводу (для стрілок), інакше прості контроли (чекбокс, повзунок, кнопка) не рахуються. */
const isTyping = (t: EventTarget | null, strict = false) => t instanceof HTMLElement && (t.isContentEditable || ['TEXTAREA', 'SELECT'].includes(t.tagName) || t.getAttribute('aria-haspopup') === 'listbox'
  || (t instanceof HTMLInputElement && (strict || !['checkbox', 'range', 'button'].includes(t.type))));

export function App() {
  const [project, setProject] = useState<Project>(() => newProject('1:1'));
  const [assets, setAssets] = useState<Assets>(() => new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [dropping, setDropping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_SETTINGS);
  const openRef = useRef<HTMLInputElement>(null);
  const fileHandle = useRef<FileHandle | null>(null); // файл, у який ⌘S зберігає мовчки
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

  const flash = useCallback((text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 2500);
  }, []);

  /** Перше збереження (і «Save as») питає місце й ім'я, далі ⌘S мовчки перезаписує той самий файл. */
  const saveProject = useCallback(async (asNew = false) => {
    const text = serializeProject(project);
    try {
      if (!canPick) { downloadText(text, projectFileName(project)); flash(`Downloaded ${projectFileName(project)}`); return; }
      let handle = fileHandle.current;
      if (!handle || asNew) {
        handle = await pickSaveHandle(projectFileName(project));
        if (!handle) return; // скасував
        fileHandle.current = handle;
      }
      await writeHandle(handle, text);
      flash(`Saved ${handle.name}`);
    } catch (e) {
      if (!isAbort(e)) setError(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [project, flash]);

  const openProject = useCallback(async (file: File, handle: FileHandle | null = null) => {
    try {
      const parsed = parseProject(await file.text());
      fileHandle.current = handle;
      const loaded = await loadAssets(parsed);
      setAssets(loaded);
      setProject(parsed);
      setSelectedId(parsed.frames[0]?.id ?? null);
      setPlaying(false);
      seek(0);
      setError(null);
    } catch (e) {
      setError(`Could not open the project: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [seek]);

  const requestOpen = useCallback(async () => {
    if (!canPick) { openRef.current?.click(); return; }
    try {
      const handle = await pickOpenHandle();
      if (handle) await openProject(await handle.getFile(), handle);
    } catch (e) {
      if (!isAbort(e)) setError(`Could not open: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [openProject]);

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

  // Гарячі клавіші. Space = play/pause (не коли друкуєш у полі), ⌘S / ⌘O — зберегти / відкрити, ← → — кадр назад / вперед, Delete — видалити кадр.
  useEffect(() => {
    const goToFrame = (step: number) => {
      const { items } = buildTimeline(project);
      if (items.length === 0) return;
      const cur = Math.max(0, items.findIndex((it) => it.rf.frame.id === selectedId));
      const next = items[Math.min(items.length - 1, Math.max(0, cur + step))];
      setSelectedId(next.rf.frame.id);
      seek(next.start);
    };
    const onDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (key === 's' || key === 'o')) {
        e.preventDefault();
        if (key === 's') void saveProject(e.shiftKey); else void requestOpen();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || exportOpen) return;
      if (e.code === 'Space' && !e.repeat && !isTyping(e.target)) { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowLeft' && !isTyping(e.target, true)) { e.preventDefault(); goToFrame(-1); }
      else if (e.key === 'ArrowRight' && !isTyping(e.target, true)) { e.preventDefault(); goToFrame(1); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !isTyping(e.target, true)) {
        e.preventDefault();
        setProject((p) => removeFrame(p, selectedId));
        setSelectedId(null);
      }
    };
    const onUp = (e: KeyboardEvent) => { if (e.code === 'Space' && !isTyping(e.target) && !exportOpen) e.preventDefault(); }; // щоб Space не «натискав» кнопку у фокусі
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [togglePlay, saveProject, requestOpen, project, selectedId, seek, exportOpen]);

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
        <input className="name" value={project.name ?? ''} placeholder="Untitled" aria-label="Project name" maxLength={60}
          onChange={(e) => setProject((p) => setProjectName(p, e.target.value))} />
        <button data-tip="Open project · ⌘ O" onClick={() => void requestOpen()}>Open</button>
        <button data-tip="Save · ⌘ S" onClick={() => void saveProject()}>Save</button>
        <button data-tip="Save as… · ⌘ ⇧ S" onClick={() => void saveProject(true)}>Save as</button>
        <input ref={openRef} type="file" accept=".json,application/json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void openProject(f); e.target.value = ''; }} />
        <Seg label="Theme" value={theme} onChange={setTheme} options={[
          { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'system', label: 'Auto' },
        ]} />
        <b className="brand">Animated Visuals</b>
        <button className="primary export-btn" onClick={() => setExportOpen(true)}>Export</button>
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
        <Preview project={project} assets={assets} t={t} playing={playing} loop={loop} duration={duration}
          onTogglePlay={togglePlay} onToggleLoop={setLoop} />
        <Resizer axis="y" invert label="Timeline height" value={layout.timeline} min={LIMITS.timeline[0]} max={LIMITS.timeline[1]}
          onChange={(timeline) => setLayout((l) => ({ ...l, timeline }))} onReset={() => setLayout((l) => ({ ...l, timeline: DEFAULT_LAYOUT.timeline }))} />
        <Timeline project={project} t={t} selectedId={selectedId} onSeek={seek} onSelect={setSelectedId}
          onDuration={(id, d) => setProject((p) => setFrameDuration(p, id, d))} />
      </div>
      <Resizer axis="x" invert label="Right panel width" value={layout.right} min={LIMITS.right[0]} max={LIMITS.right[1]}
        onChange={(right) => setLayout((l) => ({ ...l, right }))} onReset={() => setLayout((l) => ({ ...l, right: DEFAULT_LAYOUT.right }))} />
      <Sidebar project={project} selectedId={selectedId} duration={duration}
        exportSettings={exportSettings} onExportSettings={setExportSettings}
        onChange={(fn: (p: Project) => Project) => setProject(fn)} />
      <ExportPanel project={project} assets={assets} t={t} settings={exportSettings} onSettings={setExportSettings}
        open={exportOpen} onClose={() => setExportOpen(false)} />
      {error && <div className="toast error" role="alert" onClick={() => setError(null)}>{error}</div>}
      {!error && notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
