// Ρυθμίσεις χρήστη: θέμα, γλώσσα, νόμισμα.
//
// Zustand γιατί δουλεύει αυτούσιο και σε React Native. Οι τιμές κρατιούνται στο
// localStorage ώστε το θέμα να μην αναβοσβήνει στο φόρτωμα.

import { create } from 'zustand';
import type { CurrencyCode } from '../types/finance';
import { DEFAULT_CURRENCY } from '../lib/currency';

export type Theme = 'light' | 'dark' | 'system';

interface SettingsState {
  theme: Theme;
  currency: CurrencyCode;
  bufferRatio: number;
  setTheme: (theme: Theme) => void;
  setCurrency: (currency: CurrencyCode) => void;
  setBufferRatio: (ratio: number) => void;
}

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(`ft.settings.${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(`ft.settings.${key}`, JSON.stringify(value));
  } catch {
    /* ιδιωτική περιήγηση */
  }
};

export const useSettings = create<SettingsState>((set) => ({
  theme: read<Theme>('theme', 'system'),
  currency: read<CurrencyCode>('currency', DEFAULT_CURRENCY),
  bufferRatio: read<number>('bufferRatio', 0.05),

  setTheme: (theme) => {
    write('theme', theme);
    applyTheme(theme);
    set({ theme });
  },
  setCurrency: (currency) => {
    write('currency', currency);
    set({ currency });
  },
  setBufferRatio: (bufferRatio) => {
    write('bufferRatio', bufferRatio);
    set({ bufferRatio });
  },
}));

/** Βάζει ή βγάζει την κλάση `dark` από το <html>. */
export function applyTheme(theme: Theme): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
}
