import { useEffect, type ReactNode } from 'react';

// Вікно лишається змонтованим і лише ховається: хід експорту й налаштування не губляться при закритті.
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <div className="backdrop" hidden={!open} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-label={title} aria-modal="true">
        <header><h2>{title}</h2><button className="icon" aria-label="Close" onClick={onClose}>×</button></header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
