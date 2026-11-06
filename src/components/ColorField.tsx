import { useState } from 'react';
import { canEyedrop, eyedrop } from '../eyedropper';
import { PipetteIcon } from './icons';

const HEX = /^#[0-9a-f]{6}$/i;

/** Колір: квадрат-вибір, hex і піпетка в одному рядку. */
export function ColorField({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <span className="colorfield">
      <input type="color" value={HEX.test(value) ? value : '#000000'} aria-label="Color" onChange={(e) => onChange(e.target.value)} />
      <input className="hex" value={draft ?? value} spellCheck={false} aria-label="Hex color" maxLength={7}
        onChange={(e) => { setDraft(e.target.value); const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`; if (HEX.test(v)) onChange(v.toLowerCase()); }}
        onBlur={() => setDraft(null)} />
      {canEyedrop && (
        <button className="icon" aria-label="Pick color from screen" data-tip="Pick color from screen · I" data-tip-pos="left"
          onClick={async () => { const c = await eyedrop(); if (c) onChange(c); }}><PipetteIcon /></button>
      )}
    </span>
  );
}
