import { useEffect, useMemo, useRef, useState } from 'react';
import { estimateBytes, estimateMp4 } from '../export/estimate';
import { exportAll } from '../export/exportAll';
import { gifMemoryBytes } from '../export/exportGif';
import { fitToSize } from '../export/fit';
import { settingsFromJob, toJob, type ExportSettings, type QualityMode } from '../export/presets';
import { ExportAborted, exportSize, mp4IsCapped } from '../export/renderFrames';
import { canPick, pickExportHandle, writeHandle, type FileHandle } from '../projectIO';
import type { ExportJob, Project } from '../model/types';
import { projectDuration, type Assets } from '../render/renderScene';
import { Modal } from './Modal';
import { CloseIcon } from './icons';
import { CheckRow, Hint, NumberField, Row, Seg, SliderRow, Tabs } from './ui';

interface Props {
  project: Project;
  assets: Assets;
  /** Де зараз стоїть перемотування: з цього моменту береться кадр для PNG. */
  t: number;
  settings: ExportSettings;
  onSettings: (s: ExportSettings) => void;
  open: boolean;
  onClose: () => void;
}
interface Busy { text: string; progress: number | null }
interface Result { url: string; name: string; bytes: number; format: ExportJob['format']; blob: Blob; note?: string; warn?: boolean }

const MODES: { id: QualityMode; label: string }[] = [
  { id: 'max', label: 'Max' }, { id: 'balanced', label: 'Balanced' }, { id: 'small', label: 'Small' }, { id: 'custom', label: 'Custom' },
];

/** Програмний клік по посиланню: браузер зберігає файл у Завантаження. */
function startDownload(r: { url: string; name: string }) {
  const a = document.createElement('a');
  a.href = r.url; a.download = r.name; a.click();
}

const mb = (b: number) => `${(b / 1e6).toFixed(b < 1e7 ? 2 : 1)} MB`;

export function ExportPanel({ project, assets, t, settings: s, onSettings, open, onClose }: Props) {
  const [targetMb, setTargetMb] = useState(10);
  const [allowScale, setAllowScale] = useState(true);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [gifEstimate, setGifEstimate] = useState<{ key: string; bytes: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const empty = project.frames.length === 0;
  const duration = projectDuration(project);
  const job = useMemo(() => toJob(project, s), [project, s]);
  const size = exportSize(project, s.scale, s.format);
  const isPng = s.format === 'png';
  const tooBig = job.format === 'gif' && gifMemoryBytes(project, job) > 1.5e9;

  // Оцінка розміру. MP4 рахується миттєво, GIF — коротким пробним кодуванням (з паузою, щоб не рахувати на кожен рух повзунка).
  const gifKey = open && job.format === 'gif' && !empty && !tooBig
    ? JSON.stringify([job, duration, project.canvas.w, project.canvas.h, project.canvas.background, project.stage.slot, project.stage.radius, project.stage.shadow, project.stage.background?.length, project.stage.overlay?.length, project.defaults, project.frames.map((f) => [f.id, f.duration, f.motion, f.transitionOut, f.layers.map((l) => l.fit)])])
    : null;
  useEffect(() => {
    if (!gifKey || busy) return;
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      estimateBytes(project, job, assets, ctl.signal)
        .then((bytes) => setGifEstimate({ key: gifKey, bytes }))
        .catch(() => undefined);
    }, 900);
    return () => { clearTimeout(timer); ctl.abort(); };
    // project/job/assets охоплені через gifKey; busy — щоб не конкурувати з експортом
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gifKey, busy, assets]);

  const estimate: { bytes: number | null; loading: boolean } = empty || tooBig || isPng ? { bytes: null, loading: false }
    : job.format === 'mp4' ? { bytes: estimateMp4(project, job), loading: false }
      : gifEstimate?.key === gifKey ? { bytes: gifEstimate.bytes, loading: false } : { bytes: null, loading: true };

  const run = async (target: FileHandle | null, work: (signal: AbortSignal, onStatus: (t: string, p: number | null) => void) => Promise<Result | null>) => {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null); setError(null);
    const ctl = new AbortController(); abortRef.current = ctl;
    setBusy({ text: 'Starting…', progress: 0 });
    try {
      const res = await work(ctl.signal, (text, progress) => setBusy({ text, progress }));
      if (res && target) {
        setBusy({ text: 'Saving…', progress: null });
        await writeHandle(target, res.blob);
        res.note = [`Saved as ${target.name}`, res.note].filter(Boolean).join('. ');
      } else if (res) startDownload(res); // браузер без вікна збереження: звичайне скачування
      setResult(res);
    } catch (e) {
      if (!(e instanceof ExportAborted)) setError(e instanceof Error ? e.message : String(e));
    } finally { abortRef.current = null; setBusy(null); }
  };

  const makeResult = (blob: Blob, j: ExportJob, note?: string, warn?: boolean): Result => {
    const { w, h } = exportSize(project, j.scale, j.format);
    return { url: URL.createObjectURL(blob), name: `animation-${w}x${h}.${j.format}`, bytes: blob.size, format: j.format, blob, note, warn };
  };

  /** Спершу питаємо, куди зберегти (вікно має відкритись одразу після кліку), і лише потім рендеримо. */
  const chooseTarget = async (): Promise<{ handle: FileHandle | null; cancelled: boolean }> => {
    if (!canPick) return { handle: null, cancelled: false };
    const ext = `.${s.format}`;
    const mime = s.format === 'mp4' ? 'video/mp4' : s.format === 'gif' ? 'image/gif' : 'image/png';
    const base = (project.name ?? '').trim().toLowerCase().replace(/[^a-z0-9\u0400-\u04ff]+/g, '-').replace(/^-+|-+$/g, '') || 'animation';
    try {
      const handle = await pickExportHandle(`${base}${ext}`, mime, ext);
      return { handle, cancelled: handle === null };
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); return { handle: null, cancelled: true }; }
  };

  const doExport = async () => {
    const { handle, cancelled } = await chooseTarget();
    if (cancelled) return;
    await run(handle, async (signal, onStatus) => {
    const [r] = await exportAll(project, [job], assets, { signal, onStatus, time: t });
    return makeResult(r.blob, r.job);
    });
  };

  const doFit = async () => {
    const { handle, cancelled } = await chooseTarget();
    if (cancelled) return;
    await run(handle, async (signal, onStatus) => {
    const fit = await fitToSize(project, job, targetMb * 1e6, assets, allowScale, { signal, onStatus });
    onSettings(settingsFromJob(fit.job, s));
    const note = `${fit.job.fps} fps, ${exportSize(project, fit.job.scale, fit.job.format).w}×${exportSize(project, fit.job.scale, fit.job.format).h}${fit.job.gif ? `, quality ${fit.job.gif.quality}` : `, ${(fit.job.mp4!.bitrate / 1e6).toFixed(1)} Mbit/s`}`;
    return makeResult(fit.blob, fit.job,
      fit.fits ? `Fits. Settings: ${note}.` : `Could not fit into ${targetMb} MB. Smallest result: ${note}. Try MP4, a shorter animation or a smaller size.`,
      !fit.fits);
    });
  };

  const set = (patch: Partial<ExportSettings>) => onSettings({ ...s, ...patch });

  // Закриття питає підтвердження лише поки експорт іде: інакше нічого не втрачається (налаштування й результат лишаються).
  const requestClose = () => { if (busy) setConfirmClose(true); else onClose(); };

  const estimateText = empty ? '—' : tooBig ? 'too many frames' : estimate.loading ? 'estimating…' : estimate.bytes === null ? '—' : `≈ ${mb(estimate.bytes)}`;
  const presetLabel = project.canvas.preset === 'custom' ? 'custom' : project.canvas.preset;
  const summary = isPng
    ? `${size.w}×${size.h} · ${presetLabel} · frame at ${Math.min(t, duration).toFixed(2)} s · PNG`
    : `${size.w}×${size.h} · ${presetLabel} · ${duration.toFixed(1)} s @ ${s.fps} fps · ${estimateText} · ${s.format.toUpperCase()}`;

  return (
    <Modal open={open} onRequestClose={requestClose}>
      <header className="modal-head">
        <h2>Export</h2>
        <Tabs label="File format" value={s.format} onChange={(format) => set({ format })}
          options={[{ id: 'mp4', label: 'MP4' }, { id: 'gif', label: 'GIF' }, { id: 'png', label: 'PNG' }]} />
        <span className="spacer" />
        <button className="icon close" aria-label="Close" onClick={requestClose}><CloseIcon /></button>
      </header>

      <div className="export-grid">
        <div className="export-settings">
          {isPng ? (
            <div className="group first">
              <div className="grp">Image</div>
              <Row label="Frame"><b className="val">{Math.min(t, duration).toFixed(2)} s</b></Row>
              <SliderRow label="Size, %" value={s.scale} min={0.3} max={2} step={0.05} scale={100} onChange={(scale) => set({ scale })} />
            </div>
          ) : (
            <>
              <div className="group first">
                <div className="grp">Quality</div>
                <Seg label="Frames per second" value={s.fps} onChange={(fps) => set({ fps })} options={[24, 30, 60].map((f) => ({ id: f, label: `${f} fps` }))} />
                <Seg label="Quality" value={s.mode} onChange={(mode) => set({ mode })} options={MODES} />
                {s.mode === 'custom' && (
                  <>
                    {s.format === 'gif'
                      ? <SliderRow label="GIF quality" value={s.gifQuality} min={50} max={100} step={1} onChange={(gifQuality) => set({ gifQuality })} />
                      : <SliderRow label="Bitrate, Mbit/s" value={s.mp4Mbps} min={0.5} max={30} step={0.5} decimals={1} onChange={(mp4Mbps) => set({ mp4Mbps })} />}
                    <SliderRow label="Size, %" value={s.scale} min={0.3} max={1} step={0.05} scale={100} onChange={(scale) => set({ scale })} />
                  </>
                )}
              </div>
              <div className="group">
                <div className="grp">File size</div>
                {s.format === 'mp4' && mp4IsCapped(project, s.scale) && <Hint>MP4 is limited to about 4K, so it will be exported at {size.w}×{size.h} instead of {Math.round(project.canvas.w * s.scale)}×{Math.round(project.canvas.h * s.scale)}.</Hint>}
                <Row label="Estimate"><b className={`val ${estimate.bytes !== null && estimate.bytes > targetMb * 1e6 ? 'over' : ''}`}>{estimateText}</b></Row>
                {tooBig && <Hint tone="warn">Too many frames for GIF at this size. Lower the FPS or size, or use MP4.</Hint>}
                <Row label="Fit to, MB"><NumberField value={targetMb} min={0.5} max={500} step={0.5} decimals={1} onChange={setTargetMb} /></Row>
                <CheckRow label="Allow scaling down" checked={allowScale} onChange={setAllowScale} />
                <button disabled={empty || busy !== null} onClick={() => void doFit()}>Fit into {targetMb} MB and export</button>
              </div>
            </>
          )}
        </div>

        <div className="export-result">
          {busy ? (
            <div className="busy" role="status">
              <span className="hint">{busy.text}</span>
              <progress max={1} value={busy.progress ?? undefined} />
              <button onClick={() => abortRef.current?.abort()}>Cancel</button>
            </div>
          ) : result ? (
            <>
              <div className="result-media">
                {result.format === 'mp4' ? <video src={result.url} controls loop muted playsInline /> : <img src={result.url} alt="Export result" />}
              </div>
              <div className="result-info">
                <Row label={result.name}><b className={`val ${!isPng && result.bytes > targetMb * 1e6 ? 'over' : ''}`}>{mb(result.bytes)}</b></Row>
                {result.note && <Hint tone={result.warn ? 'warn' : undefined}>{result.note}</Hint>}
              </div>
            </>
          ) : error ? <Hint tone="warn">{error}</Hint> : <p className="hint center">The result appears here</p>}
        </div>
      </div>

      <footer className="export-foot">
        <p className="summary">{summary}</p>
        <button className="primary foot-btn" disabled={empty || busy !== null || tooBig} onClick={() => void doExport()}>{busy ? 'Exporting…' : `Export ${s.format.toUpperCase()}`}</button>
      </footer>

      {confirmClose && (
        <div className="confirm" role="alertdialog" aria-label="Close export">
          <div>
            <p>Export is still running. Cancel it and close?</p>
            <div className="confirm-actions">
              <button onClick={() => setConfirmClose(false)}>Keep exporting</button>
              <button className="primary" onClick={() => { abortRef.current?.abort(); setConfirmClose(false); onClose(); }}>Cancel and close</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
