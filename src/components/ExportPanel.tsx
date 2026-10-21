import { useEffect, useMemo, useRef, useState } from 'react';
import { exportAll } from '../export/exportAll';
import { estimateBytes, estimateMp4 } from '../export/estimate';
import { gifMemoryBytes } from '../export/exportGif';
import { fitToSize } from '../export/fit';
import { DEFAULT_SETTINGS, settingsFromJob, toJob, type ExportSettings, type QualityMode } from '../export/presets';
import { exportSize, ExportAborted } from '../export/renderFrames';
import type { ExportJob, Project } from '../model/types';
import { projectDuration, type Assets } from '../render/renderScene';

interface Props { project: Project; assets: Assets }
interface Busy { text: string; progress: number | null }
interface Result { url: string; name: string; bytes: number; format: 'gif' | 'mp4'; note?: string; warn?: boolean }

const MODES: { id: QualityMode; label: string; hint: string }[] = [
  { id: 'max', label: 'Макс. якість', hint: 'Найкраща картинка, файл більший' },
  { id: 'balanced', label: 'Збалансовано', hint: 'Добра картинка й помірний розмір' },
  { id: 'small', label: 'Мін. розмір', hint: 'Файл найменший, якість нижча' },
  { id: 'custom', label: 'Вручну', hint: 'Свої значення' },
];

const mb = (b: number) => `${(b / 1e6).toFixed(b < 1e7 ? 2 : 1)} МБ`;

export function ExportPanel({ project, assets }: Props) {
  const [s, setS] = useState<ExportSettings>(DEFAULT_SETTINGS);
  const [targetMb, setTargetMb] = useState(10);
  const [allowScale, setAllowScale] = useState(true);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gifEstimate, setGifEstimate] = useState<{ key: string; bytes: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const empty = project.frames.length === 0;
  const duration = projectDuration(project);
  const job = useMemo(() => toJob(project, s), [project, s]);
  const size = exportSize(project, s.scale);
  const tooBig = job.format === 'gif' && gifMemoryBytes(project, job) > 1.5e9;

  // Оцінка розміру. MP4 рахується миттєво, GIF — коротким пробним кодуванням (з паузою, щоб не рахувати на кожен рух повзунка).
  const gifKey = job.format === 'gif' && !empty && !tooBig ? JSON.stringify([job, project.frames.length, duration, project.canvas, project.defaults, project.frames.map((f) => [f.id, f.duration, f.motion, f.transitionOut, f.layers.map((l) => l.fit)])]) : null;
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

  const estimate: { bytes: number | null; loading: boolean } = empty || tooBig ? { bytes: null, loading: false }
    : job.format === 'mp4' ? { bytes: estimateMp4(project, job), loading: false }
      : gifEstimate?.key === gifKey ? { bytes: gifEstimate.bytes, loading: false } : { bytes: null, loading: true };

  const run = async (work: (signal: AbortSignal, onStatus: (t: string, p: number | null) => void) => Promise<Result | null>) => {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null); setError(null);
    const ctl = new AbortController(); abortRef.current = ctl;
    setBusy({ text: 'Починаю…', progress: 0 });
    try {
      setResult(await work(ctl.signal, (text, progress) => setBusy({ text, progress })));
    } catch (e) {
      if (!(e instanceof ExportAborted)) setError(e instanceof Error ? e.message : String(e));
    } finally { abortRef.current = null; setBusy(null); }
  };

  const makeResult = (blob: Blob, j: ExportJob, note?: string, warn?: boolean): Result => {
    const { w, h } = exportSize(project, j.scale);
    return { url: URL.createObjectURL(blob), name: `animation-${w}x${h}.${j.format}`, bytes: blob.size, format: j.format, note, warn };
  };

  const doExport = () => run(async (signal, onStatus) => {
    const [r] = await exportAll(project, [job], assets, { signal, onStatus });
    return makeResult(r.blob, r.job);
  });

  const doFit = () => run(async (signal, onStatus) => {
    const fit = await fitToSize(project, job, targetMb * 1e6, assets, allowScale, { signal, onStatus });
    setS((prev) => settingsFromJob(fit.job, prev));
    const note = `${fit.job.fps} к/с, ${exportSize(project, fit.job.scale).w}×${exportSize(project, fit.job.scale).h}${fit.job.gif ? `, якість ${fit.job.gif.quality}` : `, ${(fit.job.mp4!.bitrate / 1e6).toFixed(1)} Мбіт/с`}`;
    return makeResult(fit.blob, fit.job,
      fit.fits ? `Вмістилось. Налаштування: ${note}.` : `Не вдалося вмістити в ${targetMb} МБ. Найменше, що вийшло (${note}). Спробуй MP4, коротшу анімацію або менший розмір.`,
      !fit.fits);
  });

  const set = (patch: Partial<ExportSettings>) => setS((p) => ({ ...p, ...patch }));

  return (
    <section className="panel export">
      <h2>Експорт</h2>
      <div className="seg-buttons" role="group" aria-label="Формат файлу">
        <button className={s.format === 'mp4' ? 'on' : ''} onClick={() => set({ format: 'mp4' })}>MP4 (відео)</button>
        <button className={s.format === 'gif' ? 'on' : ''} onClick={() => set({ format: 'gif' })}>GIF</button>
      </div>
      <div className="seg-buttons" role="group" aria-label="Кадрів за секунду">
        {[24, 30, 60].map((f) => <button key={f} className={s.fps === f ? 'on' : ''} onClick={() => set({ fps: f })}>{f} к/с</button>)}
      </div>
      {s.format === 'gif' && <p className="hint">GIF зберігає час кадру в соті частки секунди, тож реальна частота трохи відрізняється (24 → ≈25, 30 → ≈33, 60 → ≈50 к/с).</p>}

      <div className="seg-buttons" role="group" aria-label="Якість">
        {MODES.map((m) => <button key={m.id} className={s.mode === m.id ? 'on' : ''} title={m.hint} onClick={() => set({ mode: m.id })}>{m.label}</button>)}
      </div>
      {s.mode === 'custom' && (
        <>
          {s.format === 'gif' ? (
            <label className="field"><span>Якість GIF: {s.gifQuality}</span>
              <input type="range" min={50} max={100} step={1} value={s.gifQuality} onChange={(e) => set({ gifQuality: Number(e.target.value) })} />
            </label>
          ) : (
            <label className="field"><span>Бітрейт: {s.mp4Mbps.toFixed(1)} Мбіт/с</span>
              <input type="range" min={0.5} max={30} step={0.5} value={s.mp4Mbps} onChange={(e) => set({ mp4Mbps: Number(e.target.value) })} />
            </label>
          )}
          <label className="field"><span>Розмір картинки: {Math.round(s.scale * 100)}% ({size.w}×{size.h})</span>
            <input type="range" min={0.3} max={1} step={0.05} value={s.scale} onChange={(e) => set({ scale: Number(e.target.value) })} />
          </label>
        </>
      )}

      <p className="row"><span>Файл</span><b>{size.w}×{size.h}, {s.fps} к/с</b></p>
      <p className="row"><span>Орієнтовний розмір</span>
        <b className={estimate.bytes !== null && estimate.bytes > targetMb * 1e6 ? 'over' : ''}>
          {empty ? '—' : tooBig ? 'забагато кадрів' : estimate.loading ? 'рахую…' : `≈ ${mb(estimate.bytes!)}`}
        </b>
      </p>
      {tooBig && <p className="hint warn">Для GIF забагато кадрів у такому розмірі. Зменш FPS, розмір або обери MP4.</p>}

      <div className="fit-row">
        <label className="field inline"><span>Вмістити в</span>
          <input type="number" min={0.5} max={500} step={0.5} value={targetMb}
            onChange={(e) => { const v = e.target.valueAsNumber; if (Number.isFinite(v) && v > 0) setTargetMb(v); }} />
          <span>МБ</span>
        </label>
        <label className="field inline"><span>Можна зменшувати розмір картинки</span>
          <input type="checkbox" checked={allowScale} onChange={(e) => setAllowScale(e.target.checked)} />
        </label>
        <button disabled={empty || busy !== null} onClick={doFit}>Вмістити в {targetMb} МБ і експортувати</button>
      </div>
      <button className="primary" disabled={empty || busy !== null || tooBig} onClick={doExport}>Експортувати</button>

      {busy && (
        <div className="busy" role="status">
          <span>{busy.text}</span>
          <progress max={1} value={busy.progress ?? undefined} />
          <button onClick={() => abortRef.current?.abort()}>Скасувати</button>
        </div>
      )}
      {error && <p className="hint warn" role="alert">{error}</p>}
      {result && (
        <div className="result">
          <p className="row"><span>{result.name}</span><b className={result.bytes > targetMb * 1e6 ? 'over' : ''}>{mb(result.bytes)}</b></p>
          {result.note && <p className={`hint ${result.warn ? 'warn' : ''}`}>{result.note}</p>}
          <a className="download" href={result.url} download={result.name}>Скачати</a>
          {result.format === 'mp4'
            ? <video src={result.url} controls loop muted playsInline />
            : <img src={result.url} alt="Результат експорту" />}
        </div>
      )}
    </section>
  );
}
