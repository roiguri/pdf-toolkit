'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore, Locale } from '@/store/useAppStore';
import { DropdownMenuContentProps } from '@radix-ui/react-dropdown-menu';

interface LocaleToggleProps {
  side?: DropdownMenuContentProps['side'];
  align?: DropdownMenuContentProps['align'];
  sideOffset?: number;
}

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'EN',
  he: 'HE',
};

export function LocaleToggle({ side = 'bottom', align = 'end', sideOffset = 4 }: LocaleToggleProps) {
  const { locale, setLocale } = useAppStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="font-semibold text-xs">
          {LOCALE_LABELS[locale]}
          <span className="sr-only">Toggle language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} sideOffset={sideOffset}>
        <DropdownMenuItem onClick={() => setLocale('en')}>
          English
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale('he')}>
          עברית
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
