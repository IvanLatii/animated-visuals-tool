import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Dropdown } from './Dropdown';

// Дрібні однакові елементи інтерфейсу: рядок «підпис — контроль», повзунок із числом, перемикач, розділ, що згортається.

const SECTIONS_KEY = 'av.sections';
function readOpen(id: string, fallback: boolean): boolean {
  try {
    const map = JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? '{}') as Record<string, boolean>;
    return map[id] ?? fallback;
  } catch { return fallback; }
}
function writeOpen(id: string, open: boolean) {
  try {
    const map = JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? '{}') as Record<string, boolean>;
    localStorage.setItem(SECTIONS_KEY, JSON.stringify({ ...map, [id]: open }));
  } catch { /* ігноруємо */ }
}

/** Відкрито / закрито, що пам'ятається між запусками. */
export function useStoredOpen(id: string, fallback: boolean): [boolean, (v: boolean) => void] {
  const [open, setOpen] = useState(() => readOpen(id, fallback));
  return [open, (v) => { setOpen(v); writeOpen(id, v); }];
}

export function Section({ id, title, defaultOpen = true, aside, children }:
  { id: string; title: string; defaultOpen?: boolean; aside?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useStoredOpen(id, defaultOpen);
  return (
    <section className={`sec ${open ? 'open' : ''}`}>
      <header>
        <button className="sec-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span>{title}</span><i aria-hidden>{open ? '–' : '+'}</i>
        </button>
        {aside}
      </header>
      {/* Вміст лишається в DOM і плавно згортається (grid 0fr → 1fr), тож стан полів не губиться */}
      <div className="sec-collapse"><div className="sec-wrap"><div className="sec-body">{children}</div></div></div>
    </section>
  );
}

/** wide: контроль займає половину рядка (як таби над ним). */
export function Row({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`r ${wide ? 'wide' : ''}`}><span className="lab">{label}</span><span className="ctl">{children}</span></label>;
}

export function Hint({ children, tone }: { children: ReactNode; tone?: 'warn' }) {
  return <p className={`hint ${tone === 'warn' ? 'warn' : ''}`} role={tone === 'warn' ? 'alert' : undefined}>{children}</p>;
}

export function NumberField({ value, onChange, min, max, step = 1, decimals = 0, width }:
  { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; decimals?: number; width?: number }) {
  // Поки друкуємо, число може бути неповним, тому тримаємо текст окремо й віддаємо лише коректне.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input className="num" type="number" min={min} max={max} step={step} style={width ? { width } : undefined}
      value={draft ?? value.toFixed(decimals)}
      onChange={(e) => {
        setDraft(e.target.value);
        const v = e.target.valueAsNumber;
        if (Number.isFinite(v) && v >= min && v <= max) onChange(v);
      }}
      onBlur={() => setDraft(null)} />
  );
}

/** value — у одиницях моделі; scale перетворює їх для показу (0.2 → 20 %). */
export function SliderRow({ label, value, min, max, step, onChange, scale = 1, decimals = 0, disabled }:
  { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; scale?: number; decimals?: number; disabled?: boolean }) {
  return (
    <div className="r slider">
      <span className="lab">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} aria-label={label}
        style={{ '--p': `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))} />
      <NumberField value={value * scale} min={min * scale} max={max * scale} step={step * scale} decimals={decimals}
        onChange={(v) => onChange(v / scale)} width={48} />
    </div>
  );
}

/** Темна заливка вибраного пункту плавно переїжджає: міряємо позицію активної кнопки й віддаємо CSS через змінні. */
function usePill(ref: RefObject<HTMLElement | null>, active: unknown) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const on = el.querySelector<HTMLElement>('button.on');
      el.style.setProperty('--pill-x', `${on?.offsetLeft ?? 0}px`);
      el.style.setProperty('--pill-w', `${on?.offsetWidth ?? 0}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, active]);
}

export function Seg<T extends string | number>({ value, options, onChange, label }:
  { value: T; options: { id: T; label: string; title?: string; disabled?: boolean }[]; onChange: (v: T) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  usePill(ref, value);
  return (
    <div ref={ref} className="seg pill-host" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.id)} className={o.id === value ? 'on' : ''} title={o.title} disabled={o.disabled} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export function SelectRow<T extends string>({ label, value, options, onChange }:
  { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <Row label={label} wide>
      <Dropdown label={label} value={value} options={options} onChange={onChange} />
    </Row>
  );
}

export function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <Row label={label}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /></Row>;
}

export function Tabs<T extends string>({ value, options, onChange, label }:
  { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  usePill(ref, value);
  return (
    <div ref={ref} className="tabs pill-host" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={o.id === value} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}
