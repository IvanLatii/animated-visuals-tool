import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

interface Option<T> { id: T; label: string }
interface Props<T> { value: T; options: Option<T>[]; onChange: (v: T) => void; label: string }

const ITEM_H = 24;

// Власний список замість системного: системний не стилізується (кути, фон, ширина).
export function Dropdown<T extends string>({ value, options, onChange, label }: Props<T>) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<{ left: number; top: number; width: number } | null>(null);
  const [active, setActive] = useState(0);
  const current = options.find((o) => o.id === value);
  const open = menu !== null;

  const openMenu = () => {
    const r = btnRef.current!.getBoundingClientRect();
    const h = options.length * ITEM_H + 2;
    const up = r.bottom + h > window.innerHeight - 8 && r.top > h; // не влазить вниз — відкриваємо вгору
    setMenu({ left: r.left, top: up ? r.top - h : r.bottom - 1, width: r.width });
    setActive(Math.max(0, options.findIndex((o) => o.id === value)));
  };
  const close = () => setMenu(null);
  const choose = (id: T) => { onChange(id); close(); };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!t.closest('.dd-menu') && !btnRef.current?.contains(t)) close();
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { openMenu(); return; }
      setActive((a) => Math.min(options.length - 1, Math.max(0, a + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open) choose(options[active].id); else openMenu();
    } else if (e.key === 'Escape' && open) { e.stopPropagation(); close(); }
  };

  return (
    <>
      <button ref={btnRef} type="button" className="dd" aria-haspopup="listbox" aria-expanded={open} aria-label={label}
        onClick={() => (open ? close() : openMenu())} onKeyDown={onKeyDown}>
        <span>{current?.label ?? ''}</span><i className="caret" aria-hidden />
      </button>
      {menu && createPortal(
        <div className="dd-menu" role="listbox" style={{ left: menu.left, top: menu.top, width: menu.width }}>
          {options.map((o, i) => (
            <div key={o.id} role="option" aria-selected={o.id === value} className={`${o.id === value ? 'cur' : ''} ${i === active ? 'act' : ''}`}
              onPointerEnter={() => setActive(i)} onClick={() => choose(o.id)}>{o.label}</div>
          ))}
        </div>, document.body)}
    </>
  );
}
