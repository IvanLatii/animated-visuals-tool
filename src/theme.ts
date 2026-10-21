export type Theme = 'light' | 'dark' | 'system';
const KEY = 'av.theme';

// localStorage може бути недоступним (приватне вікно, заблоковані дані), тому все в try/catch.
export function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch { /* без збереження теж працює */ }
  return 'light';
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(KEY, theme); } catch { /* ігноруємо */ }
}
