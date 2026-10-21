import { useEffect, useMemo, useRef, useState } from 'react';
import { exportAll } from '../export/exportAll';
import { estimateBytes, estimateMp4 } from '../export/estimate';
import { gifMemoryBytes } from '../export/exportGif';
import { fitToSize } from '../export/fit';
import { DEFAULT_SETTINGS, settingsFromJob, toJob, type ExportSettings, type QualityMode } from '../export/presets';
import { exportSize, ExportAborted } from '../export/renderFrames';
import type { ExportJob, Project } from '../model/types';
import { projectDuration, type Assets } from '../render/renderScene';
import { CheckRow, Hint, NumberField, Row, Section, Seg, SliderRow } from './ui';

interface Props { project: Project; assets: Assets }
interface Busy { text: string; progress: number | null }
interface Result { url: string; name: string; bytes: number; format: 'gif' | 'mp4'; note?: string; warn?: boolean }

const MODES: { id: QualityMode; label: string }[] = [
  { id: 'max', label: 'Max' }, { id: 'balanced', label: 'Balanced' }, { id: 'small', label: 'Small' }, { id: 'custom', label: 'Custom' },
];

const mb = (b: number) => `${(b / 1e6).toFixed(b < 1e7 ? 2 : 1)} MB`;

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
    setBusy({ text: 'Starting…', progress: 0 });
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
    const note = `${fit.job.fps} fps, ${exportSize(project, fit.job.scale).w}×${exportSize(project, fit.job.scale).h}${fit.job.gif ? `, quality ${fit.job.gif.quality}` : `, ${(fit.job.mp4!.bitrate / 1e6).toFixed(1)} Mbit/s`}`;
    return makeResult(fit.blob, fit.job,
      fit.fits ? `Fits. Settings: ${note}.` : `Could not fit into ${targetMb} MB. Smallest result: ${note}. Try MP4, a shorter animation or a smaller size.`,
      !fit.fits);
  });

  const set = (patch: Partial<ExportSettings>) => setS((p) => ({ ...p, ...patch }));

  return (
    <>
      <Section id="exp-format" title="Format">
        <Seg label="File format" value={s.format} onChange={(format) => set({ format })} options={[{ id: 'mp4', label: 'MP4' }, { id: 'gif', label: 'GIF' }]} />
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
      </Section>

      <Section id="exp-size" title="File size">
        <Row label="File"><b className="val">{size.w}×{size.h}, {s.fps} fps</b></Row>
        <Row label="Estimate">
          <b className={`val ${estimate.bytes !== null && estimate.bytes > targetMb * 1e6 ? 'over' : ''}`}>
            {empty ? '—' : tooBig ? 'too many frames' : estimate.loading ? 'estimating…' : `≈ ${mb(estimate.bytes!)}`}
          </b>
        </Row>
        {tooBig && <Hint tone="warn">Too many frames for GIF at this size. Lower the FPS or size, or use MP4.</Hint>}
        <Row label="Fit to, MB"><NumberField value={targetMb} min={0.5} max={500} step={0.5} decimals={1} width={56} onChange={setTargetMb} /></Row>
        <CheckRow label="Allow scaling down" checked={allowScale} onChange={setAllowScale} />
        <button disabled={empty || busy !== null} onClick={doFit}>Fit into {targetMb} MB and export</button>
      </Section>

      <div className="pad">
        <button className="primary" disabled={empty || busy !== null || tooBig} onClick={doExport}>Export {s.format === 'mp4' ? 'MP4' : 'GIF'}</button>
      </div>

      {busy && (
        <div className="pad busy" role="status">
          <span>{busy.text}</span>
          <progress max={1} value={busy.progress ?? undefined} />
          <button onClick={() => abortRef.current?.abort()}>Cancel</button>
        </div>
      )}
      {error && <div className="pad"><Hint tone="warn">{error}</Hint></div>}
      {result && (
        <div className="pad result">
          <Row label={result.name}><b className={`val ${result.bytes > targetMb * 1e6 ? 'over' : ''}`}>{mb(result.bytes)}</b></Row>
          {result.note && <Hint tone={result.warn ? 'warn' : undefined}>{result.note}</Hint>}
          <a className="download" href={result.url} download={result.name}>Download</a>
          {result.format === 'mp4'
            ? <video src={result.url} controls loop muted playsInline />
            : <img src={result.url} alt="Export result" />}
        </div>
      )}
    </>
  );
}
