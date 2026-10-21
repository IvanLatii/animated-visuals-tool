import { useRef } from 'react';

interface Props {
  axis: 'x' | 'y';
  value: number;
  min: number;
  max: number;
  /** true, якщо тягнути в бік зменшення координати має збільшувати значення (права панель, таймлайн) */
  invert?: boolean;
  onChange: (v: number) => void;
  onReset: () => void;
  label: string;
}

// Тонка смужка між блоками: тягнеш — змінюється розмір, подвійний клік — повертає як було.
export function Resizer({ axis, value, min, max, invert = false, onChange, onReset, label }: Props) {
  const start = useRef<{ pos: number; value: number } | null>(null);
  const pos = (e: React.PointerEvent) => (axis === 'x' ? e.clientX : e.clientY);
  return (
    <div className={`resizer ${axis}`} role="separator" aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'} aria-label={label}
      onPointerDown={(e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* штучна подія без реального вказівника */ } start.current = { pos: pos(e), value }; }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const delta = (pos(e) - start.current.pos) * (invert ? -1 : 1);
        onChange(Math.min(max, Math.max(min, start.current.value + delta)));
      }}
      onPointerUp={() => { start.current = null; }}
      onDoubleClick={onReset} />
  );
}
