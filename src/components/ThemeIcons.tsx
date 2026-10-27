import type { ReactNode } from 'react';
import type { Theme } from '../theme';

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>{children}</svg>
);

// Світла — сонце, Dim — коло, наполовину залите (середня між світлою й темною), Dark — місяць.
export const THEME_OPTIONS: { id: Theme; label: string; icon: ReactNode }[] = [
  { id: 'light', label: 'Light', icon: svg(<><circle cx="8" cy="8" r="2.8" /><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1" /></>) },
  { id: 'dim', label: 'Dim', icon: svg(<><circle cx="8" cy="8" r="5.2" /><path d="M8 2.8a5.2 5.2 0 0 1 0 10.4z" fill="currentColor" /></>) },
  { id: 'dark', label: 'Dark', icon: svg(<path d="M12.8 9.6A5.4 5.4 0 0 1 6.4 3.2a5.4 5.4 0 1 0 6.4 6.4z" />) },
];
