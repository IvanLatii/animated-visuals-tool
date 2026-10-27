export type Theme = 'light' | 'dim' | 'dark';
const KEY = 'av.theme';

// localStorage може бути недоступним (приватне вікно, заблоковані дані), тому все в try/catch.
export function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dim' || v === 'dark') return v; // старе значення «system» відпадає й дає світлу
  } catch { /* без збереження теж працює */ }
  return 'light';
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(KEY, theme); } catch { /* ігноруємо */ }
}
