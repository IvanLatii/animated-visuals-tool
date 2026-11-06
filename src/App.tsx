import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { fileToDataUrl, loadImage } from './assets';
import { isMediaFile, readMedia, type ReadMedia } from './media/readMedia';
import { ExportPanel } from './components/ExportPanel';
import { Sidebar, type Target } from './components/Sidebar';
import { LayersPanel } from './components/LayersPanel';
import { Preview } from './components/Preview';
import { Resizer } from './components/Resizer';
import { useStoredOpen } from './components/ui';
import { useHistory } from './useHistory';
import { Seg } from './components/ui';
import { DEFAULT_LAYOUT, LIMITS, loadLayout, saveLayout, type Layout } from './layout';
import { Timeline } from './components/Timeline';
import { THEME_OPTIONS } from './components/ThemeIcons';
import { applyTheme, loadTheme, type Theme } from './theme';
import { DEFAULT_SETTINGS, type ExportSettings } from './export/presets';
import { newProject } from './model/defaults';
import type { Project } from './model/types';
import { parseProject, projectFileName, serializeProject } from './model/projectFile';
import { canPick, downloadText, isAbort, pickOpenHandle, pickSaveHandle, writeHandle, type FileHandle } from './projectIO';
import { buildTimeline, loadAssets, projectDuration, type Assets } from './render/renderScene';
import { addFrames, addLayer, applyLayerPatches, moveLayer, nudgeLayers, removeLayer, replaceLayer, moveFrame, newFrame, removeFrame, replaceFrameImage, setCanvasSize, setFrameDuration, setProjectName, setSlot, setStageImage } from './state/projectActions';

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');

/** Чи Іван зараз друкує. strict = true: будь-яке поле вводу (для стрілок), інакше прості контроли (чекбокс, повзунок, кнопка) не рахуються. */
const isTyping = (t: EventTarget | null, strict = false) => t instanceof HTMLElement && (t.isContentEditable || ['TEXTAREA', 'SELECT'].includes(t.tagName) || t.getAttribute('aria-haspopup') === 'listbox'
  || (t instanceof HTMLInputElement && (strict || !['checkbox', 'range', 'button'].includes(t.type))));

export function App() {
  const [project, setProject] = useState<Project>(() => newProject('1:1'));
  const [assets, setAssets] = useState<Assets>(() => new Map());
  const [selection, setSelection] = useState<string[]>([]); // виділені кадри; останній — «основний»
  const anchor = useRef<string | null>(null); // від чого рахується діапазон Shift
  const selectedId = selection[selection.length - 1] ?? null;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [dropping, setDropping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [editSlot, setEditSlot] = useState(false); // рамка вікна вмісту; рамка зображення з'являється сама при виділенні
  const [keepProportions, setKeepProportions] = useStoredOpen('keep-proportions', true); // замок пропорцій, за замовчуванням увімкнений
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_SETTINGS);
  const openRef = useRef<HTMLInputElement>(null);
  const fileHandle = useRef<FileHandle | null>(null); // файл, у який ⌘S зберігає мовчки
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [layout, setLayout] = useState<Layout>(loadLayout);
  const tRef = useRef(0);

  const duration = projectDuration(project);
  const applyProject = useCallback((p: Project) => {
    setProject(p);
    setSelection((s) => s.filter((id) => p.frames.some((f) => f.id === id))); // виділення не вказує на кадри, яких уже нема
  }, []);
  const { undo, redo, canUndo, canRedo } = useHistory(project, applyProject, 10);
  const [layerSel, setLayerSel] = useState<'background' | 'overlay' | null>(null); // вибраний шар-картинка в Layers (фон або накладка)
  const [activeLayer, setActiveLayer] = useState(0); // вибраний шар усередині кадру (0 — нижній); значення поза межами означає верхній
  const selectOne = useCallback((id: string | null) => { setSelection(id ? [id] : []); setLayerSel(null); setActiveLayer(0); anchor.current = id; }, []);
  const selectLayer = useCallback((kind: 'background' | 'overlay') => { setSelection([]); setLayerSel(kind); anchor.current = null; }, []);
  const target: Target = selection.length > 0 ? 'frames' : layerSel ?? 'project'; // що показує Inspector
  const selectedFrame = project.frames.find((f) => f.id === selectedId);
  const selImg = selectedFrame ? assets.get(selectedFrame.layers[Math.min(activeLayer, selectedFrame.layers.length - 1)].src) : undefined;
  const selectedImage = selImg ? { w: selImg.width, h: selImg.height } : null;

  const seek = useCallback((time: number) => { tRef.current = time; setT(time); }, []);
  const pendingSeek = useRef<string | null>(null);
  useEffect(() => { // щойно доданий кадр одразу видно на сцені
    if (!pendingSeek.current) return;
    const it = buildTimeline(project).items.find((x) => x.rf.frame.id === pendingSeek.current);
    if (it) { seek(it.start); pendingSeek.current = null; }
  }, [project, seek]);

  const selectFrame = useCallback((id: string, mode: 'single' | 'toggle' | 'range') => {
    if (mode === 'single') {
      selectOne(id);
      const it = buildTimeline(project).items.find((x) => x.rf.frame.id === id);
      if (it) seek(it.start); // на сцені одразу видно вибраний кадр
      return;
    }
    const order = project.frames.map((f) => f.id);
    if (mode === 'toggle') {
      setLayerSel(null);
      setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
      anchor.current = id;
      return;
    }
    const a = order.indexOf(anchor.current ?? selectedId ?? id), b = order.indexOf(id);
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    const range = order.slice(lo, hi + 1);
    setLayerSel(null);
    setSelection(a > b ? range.reverse() : range); // натиснутий кадр стає останнім — основним
  }, [project, selectedId, selectOne, seek]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const media = [...files].filter(isMediaFile);
    if (media.length === 0) { setError('Unsupported file. Use PNG, JPG, WebP, GIF or a video (MP4, WebM).'); return; }
    setError(null);
    const loaded: { frame: ReturnType<typeof newFrame>; read: ReadMedia }[] = [];
    for (const file of media) {
      try {
        const read = await readMedia(file);
        loaded.push({ frame: newFrame(read.src, file.name.replace(/\.[^.]+$/, ''), read.clip), read });
      } catch (e) {
        setError(`Could not open "${file.name}": ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    }
    if (loaded.length === 0) return;
    setAssets((prev) => {
      const next = new Map(prev);
      for (const { frame, read } of loaded) next.set(frame.layers[0].src, read.asset);
      return next;
    });
    setProject((p) => addFrames(p, loaded.map((l) => l.frame)));
    selectOne(loaded[loaded.length - 1].frame.id);
    pendingSeek.current = loaded[loaded.length - 1].frame.id; // після оновлення проєкту перемотаємо до цього кадру
  }, [selectOne]);

  /** Додає картинку, GIF чи відео шаром поверх вибраного кадру. */
  const addLayerFile = useCallback(async (id: string, file: File) => {
    if (!isMediaFile(file)) { setError('Unsupported file. Use PNG, JPG, WebP, GIF or a video (MP4, WebM).'); return; }
    try {
      const read = await readMedia(file);
      setAssets((prev) => new Map(prev).set(read.src, read.asset));
      setProject((p) => addLayer(p, id, read.src, file.name.replace(/\.[^.]+$/, ''), read.clip));
      setActiveLayer(1e6); // новий шар лягає зверху й одразу вибраний (споживачі обмежують індекс останнім шаром)
      setError(null);
    } catch (e) {
      setError(`Could not open "${file.name}": ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  }, []);

  /** Заміна картинки/відео в одному шарі кадру: розмір, зсув і поворот шару лишаються. */
  const replaceLayerFile = useCallback(async (id: string, index: number, file: File) => {
    if (!isMediaFile(file)) { setError('Unsupported file. Use PNG, JPG, WebP, GIF or a video (MP4, WebM).'); return; }
    try {
      const read = await readMedia(file);
      setAssets((prev) => new Map(prev).set(read.src, read.asset));
      setProject((p) => replaceLayer(p, id, index, read.src, file.name.replace(/\.[^.]+$/, ''), read.clip));
      setError(null);
    } catch (e) {
      setError(`Could not open "${file.name}": ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  }, []);

  /** Перестановка шарів: вибраний шар лишається тим самим шаром (його індекс слідує за ним). */
  const moveLayerTo = useCallback((id: string, from: number, to: number) => {
    setProject((p) => moveLayer(p, id, from, to));
    setActiveLayer((cur) => {
      const n = project.frames.find((f) => f.id === id)?.layers.length ?? 1;
      const a = Math.min(cur, n - 1);
      if (a === from) return to;
      if (from < a && to >= a) return a - 1;
      if (from > a && to <= a) return a + 1;
      return a;
    });
  }, [project.frames]);

  const replaceFile = useCallback(async (id: string, file: File) => {
    if (!isMediaFile(file)) { setError('Unsupported file. Use PNG, JPG, WebP, GIF or a video (MP4, WebM).'); return; }
    try {
      const read = await readMedia(file);
      setAssets((prev) => new Map(prev).set(read.src, read.asset));
      setProject((p) => replaceFrameImage(p, id, read.src, file.name.replace(/\.[^.]+$/, ''), read.clip));
      setError(null);
    } catch (e) {
      setError(`Could not open "${file.name}": ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  }, []);

  const flash = useCallback((text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 2500);
  }, []);

  // Фон і накладка. Фон одразу підганяє полотно під свій розмір (з Figma зазвичай готовий розмір), далі розмір можна змінити.
  const pickStageImage = useCallback(async (kind: 'background' | 'overlay', file: File) => {
    if (!file.type.startsWith('image/')) { setError('That is not an image. Use PNG, JPG or WebP.'); return; }
    try {
      const src = await fileToDataUrl(file);
      const img = await loadImage(src);
      setAssets((prev) => new Map(prev).set(src, img));
      const k = Math.min(1, 4096 / Math.max(img.naturalWidth, img.naturalHeight));
      setProject((p) => {
        const next = setStageImage(p, kind, src, file.name.replace(/\.[^.]+$/, ''));
        return kind === 'background' ? setCanvasSize(next, img.naturalWidth * k, img.naturalHeight * k) : next;
      });
      setError(null);
      if (kind === 'background') flash(`Canvas set to ${Math.round(img.naturalWidth * k)}×${Math.round(img.naturalHeight * k)} to match the background`);
    } catch {
      setError(`Could not open "${file.name}".`);
    }
  }, [flash]);

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
      setAssets((prev) => new Map([...prev, ...loaded])); // старі зображення лишаємо, щоб працювало скасування
      setProject(parsed);
      selectOne(parsed.frames[0]?.id ?? null);
      setPlaying(false);
      seek(0);
      setError(null);
    } catch (e) {
      setError(`Could not open the project: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [seek, selectOne]);

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

  // Гарячі клавіші. Space = play/pause (не коли друкуєш у полі), ⌘S / ⌘O — зберегти / відкрити, стрілки — рух вибраного зображення (Shift = 10 px; без вибору ← → — кадр назад / вперед; Alt + ← → завжди кадр), Delete — видалити кадр.
  useEffect(() => {
    const goToFrame = (step: number) => {
      const { items } = buildTimeline(project);
      if (items.length === 0) return;
      const cur = Math.max(0, items.findIndex((it) => it.rf.frame.id === selectedId));
      const next = items[Math.min(items.length - 1, Math.max(0, cur + step))];
      selectOne(next.rf.frame.id);
      seek(next.start);
    };
    const onDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !isTyping(e.target, true) && (key === 'z' || key === 'y')) {
        e.preventDefault();
        if (key === 'y' || e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (key === 's' || key === 'o')) {
        e.preventDefault();
        if (key === 's') void saveProject(e.shiftKey); else void requestOpen();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.altKey && key === 'a' && !isTyping(e.target, true) && !exportOpen) {
        e.preventDefault();
        setLayerSel(null);
        setSelection(project.frames.map((f) => f.id));
        return;
      }
      if (e.altKey && !e.metaKey && !e.ctrlKey && !exportOpen && !isTyping(e.target, true) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault(); goToFrame(e.key === 'ArrowLeft' ? -1 : 1); // Alt + ← → — кадр назад / вперед
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || exportOpen) return;
      if (e.key === 'Home' && !isTyping(e.target, true)) { e.preventDefault(); seek(0); return; } // Home — таймлайн на початок
      const arrow = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
      if (e.code === 'Space' && !e.repeat && !isTyping(e.target)) { e.preventDefault(); togglePlay(); }
      else if (arrow && selection.length > 0 && !isTyping(e.target, true)) {
        // Стрілки рухають вибране зображення (вибраний шар): 1 px, з Shift 10 px
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const px = e.key === 'ArrowLeft' ? { x: -step, y: 0 } : e.key === 'ArrowRight' ? { x: step, y: 0 } : e.key === 'ArrowUp' ? { x: 0, y: -step } : { x: 0, y: step };
        setProject((p) => nudgeLayers(p, selection, px.x, px.y, activeLayer));
      }
      else if (e.key === 'ArrowLeft' && !isTyping(e.target, true)) { e.preventDefault(); goToFrame(-1); }
      else if (e.key === 'ArrowRight' && !isTyping(e.target, true)) { e.preventDefault(); goToFrame(1); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length > 0 && !isTyping(e.target, true)) {
        e.preventDefault();
        setProject((p) => selection.reduce(removeFrame, p));
        selectOne(null);
      }
    };
    const onUp = (e: KeyboardEvent) => { if (e.code === 'Space' && !isTyping(e.target) && !exportOpen) e.preventDefault(); }; // щоб Space не «натискав» кнопку у фокусі
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [togglePlay, saveProject, requestOpen, project, selectedId, selection, selectOne, seek, exportOpen, undo, redo, activeLayer]);

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
        <button data-tip="Open a saved project · ⌘ O" onClick={() => void requestOpen()}>Open</button>
        <button data-tip="Save project to keep editing later · ⌘ S" onClick={() => void saveProject()}>Save</button>
        <button data-tip="Save project to a new file · ⌘ ⇧ S" onClick={() => void saveProject(true)}>Save as</button>
        <input ref={openRef} type="file" accept=".json,application/json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void openProject(f); e.target.value = ''; }} />
        <b className="brand">Animated Visuals<i className="logo" aria-hidden /></b>
        <button className="primary export-btn" data-tip="Make the final MP4, GIF or PNG" data-tip-pos="left" onClick={() => setExportOpen(true)}>Export</button>
      </header>
      <div className="left">
      <LayersPanel project={project} selection={selection} layerSel={layerSel}
        onSelectFrame={selectFrame} onSelectLayer={selectLayer} onDeselect={() => selectOne(null)}
        onSelectAll={() => { setLayerSel(null); setSelection(project.frames.map((f) => f.id)); }}
        onRemove={(id) => { setProject((p) => removeFrame(p, id)); setSelection((s) => s.filter((x) => x !== id)); }}
        onMove={(from, to) => setProject((p) => moveFrame(p, from, to))}
        onPickFiles={(files) => void addFiles(files)}
        onReplace={(id, file) => void replaceFile(id, file)}
        onClear={() => { setProject((p) => ({ ...p, frames: [] })); selectOne(null); setPlaying(false); seek(0); }}
        onPickImage={(k, f) => void pickStageImage(k, f)}
        onClearImage={(k) => { setProject((p) => setStageImage(p, k, undefined)); setLayerSel(null); }} />
        <div className="left-foot">
          <span>Theme</span>
          <Seg label="Theme" value={theme} onChange={setTheme} options={THEME_OPTIONS} />
        </div>
      </div>
      <Resizer axis="x" label="Left panel width" value={layout.left} min={LIMITS.left[0]} max={LIMITS.left[1]}
        onChange={(left) => setLayout((l) => ({ ...l, left }))} onReset={() => setLayout((l) => ({ ...l, left: DEFAULT_LAYOUT.left }))} />
      <div className="center">
        <Preview project={project} assets={assets} t={t} editSlot={editSlot} onSlot={(r) => setProject((p) => setSlot(p, r))}
          selection={selection} keep={keepProportions} activeLayer={activeLayer} onPatches={(patches) => setProject((p) => applyLayerPatches(p, patches, activeLayer))}
          canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} playing={playing} loop={loop} duration={duration}
          onTogglePlay={togglePlay} onToggleLoop={setLoop} />
        <Resizer axis="y" invert label="Timeline height" value={layout.timeline} min={LIMITS.timeline[0]} max={LIMITS.timeline[1]}
          onChange={(timeline) => setLayout((l) => ({ ...l, timeline }))} onReset={() => setLayout((l) => ({ ...l, timeline: DEFAULT_LAYOUT.timeline }))} />
        <Timeline project={project} t={t} selection={selection} onSeek={seek} onSelect={selectOne}
          onDuration={(id, d, trim) => setProject((p) => setFrameDuration(p, id, d, trim ? 'trim' : undefined))} />
      </div>
      <Resizer axis="x" invert label="Right panel width" value={layout.right} min={LIMITS.right[0]} max={LIMITS.right[1]}
        onChange={(right) => setLayout((l) => ({ ...l, right }))} onReset={() => setLayout((l) => ({ ...l, right: DEFAULT_LAYOUT.right }))} />
      <Sidebar project={project} target={target} selection={selection} assets={assets} duration={duration}
        exportSettings={exportSettings} onExportSettings={setExportSettings}
        keep={keepProportions} onKeep={setKeepProportions}
        frameLayers={{ li: activeLayer, onSelect: setActiveLayer, onAdd: (id, f) => void addLayerFile(id, f), onRemove: (id, i) => { setProject((p) => removeLayer(p, id, i)); setActiveLayer(0); }, onReplace: (id, i, f) => void replaceLayerFile(id, i, f), onMove: moveLayerTo }}
        slot={{ selectedImage, editSlot, onEditSlot: setEditSlot }}
        layer={{ onPickImage: (k, f) => void pickStageImage(k, f), onClearImage: (k) => { setProject((p) => setStageImage(p, k, undefined)); setLayerSel(null); } }}
        onChange={(fn: (p: Project) => Project) => setProject(fn)} />
      <ExportPanel project={project} assets={assets} t={t} settings={exportSettings} onSettings={setExportSettings}
        open={exportOpen} onClose={() => setExportOpen(false)} />
      {error && <div className="toast error" role="alert" onClick={() => setError(null)}>{error}</div>}
      {!error && notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
