import { StateCreator } from 'zustand';
import type { AppState } from '../useAppStore';

export type Locale = 'en' | 'he';

const LOCALE_STORAGE_KEY = 'locale';

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  return (localStorage.getItem(LOCALE_STORAGE_KEY) as Locale) ?? 'en';
}

export interface LocaleSlice {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const createLocaleSlice: StateCreator<AppState, [], [], LocaleSlice> = (set) => ({
  locale: getInitialLocale(),
  setLocale: (locale) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    set({ locale });
  },
});
