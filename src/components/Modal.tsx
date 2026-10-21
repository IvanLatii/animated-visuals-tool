import { useEffect, type ReactNode } from 'react';

// Лише рамка вікна: заголовок і вміст малює той, хто його відкриває. Лишається змонтованим і ховається — хід експорту не губиться.
export function Modal({ open, onRequestClose, children }: { open: boolean; onRequestClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onRequestClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onRequestClose]);
  return (
    <div className="backdrop" hidden={!open} onPointerDown={(e) => { if (e.target === e.currentTarget) onRequestClose(); }}>
      <div className="modal" role="dialog" aria-label="Export" aria-modal="true">{children}</div>
    </div>
  );
}
