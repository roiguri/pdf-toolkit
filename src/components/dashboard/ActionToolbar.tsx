// src/components/dashboard/ActionToolbar.tsx
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { useAppStore, AppMode } from '@/store/useAppStore';
import {
  SplitSquareVertical,
  Combine,
  Image,
  PenLine,
  Shrink,
  ChevronDown,
  Eye,
  ScanLine,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ActionToolbar = () => {
  const { setActiveMode, activeMode, mergeSelection, clearMergeSelection } = useAppStore();
  const { t } = useTranslation('dashboard');

  const handleModeChange = (mode: AppMode) => {
    setActiveMode(mode);
    if (mode !== 'merge') {
      clearMergeSelection(); // Clear merge selection when switching out of merge mode
    }
  };

  const getActiveModeLabel = () => {
    switch (activeMode) {
      case 'view':
        return t('modes.view');
      case 'split':
        return t('modes.split');
      case 'merge':
        return mergeSelection.length > 0
          ? t('modes.mergeCount', { count: mergeSelection.length })
          : t('modes.merge');
      case 'convert':
        return t('modes.convert');
      case 'edit':
        return t('modes.edit');
      case 'compress':
        return t('modes.compress');
      case 'scan':
        return t('modes.scan');
      default:
        return t('modes.actions');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-auto min-w-0 max-w-[200px] shrink justify-between">
          <span className="flex items-center gap-2 min-w-0">
            {activeMode === 'view' && <Eye className="h-4 w-4 flex-shrink-0" />}
            {activeMode === 'split' && <SplitSquareVertical className="h-4 w-4 flex-shrink-0" />}
            {activeMode === 'merge' && <Combine className="h-4 w-4 flex-shrink-0" />}
            {activeMode === 'convert' && <Image className="h-4 w-4 flex-shrink-0" />}
            {activeMode === 'edit' && <PenLine className="h-4 w-4 flex-shrink-0" />}
            {activeMode === 'compress' && <Shrink className="h-4 w-4 flex-shrink-0" />}
            {activeMode === 'scan' && <ScanLine className="h-4 w-4 flex-shrink-0" />}
            <span className="truncate">{getActiveModeLabel()}</span>
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]" align="start">
        <DropdownMenuRadioGroup value={activeMode} onValueChange={(value) => handleModeChange(value as AppMode)}>
          <DropdownMenuRadioItem value="view">
            <Eye className="me-2 h-4 w-4" />
            {t('modes.view')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="split">
            <SplitSquareVertical className="me-2 h-4 w-4" />
            {t('modes.split')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="merge">
            <Combine className="me-2 h-4 w-4" />
            {t('modes.merge')} {mergeSelection.length > 0 && `(${mergeSelection.length})`}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="convert">
            <Image className="me-2 h-4 w-4" />
            {t('modes.convert')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="edit">
            <PenLine className="me-2 h-4 w-4" />
            {t('modes.edit')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="compress">
            <Shrink className="me-2 h-4 w-4" />
            {t('modes.compress')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="scan">
            <ScanLine className="me-2 h-4 w-4" />
            {t('modes.scan')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ActionToolbar;
