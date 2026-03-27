'use client';

import { useLayoutEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import i18n from '@/i18n/config';
import { DirectionProvider } from '@radix-ui/react-direction';

interface LocaleProviderProps {
  children: React.ReactNode;
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const locale = useAppStore((state) => state.locale);
  const dir = locale === 'he' ? 'rtl' : 'ltr';

  useLayoutEffect(() => {
    i18n.changeLanguage(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  return <DirectionProvider dir={dir}>{children}</DirectionProvider>;
}
