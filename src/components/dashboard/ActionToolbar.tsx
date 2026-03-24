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

const ActionToolbar = () => {
  const { setActiveMode, activeMode, mergeSelection, clearMergeSelection } = useAppStore();

  const handleModeChange = (mode: AppMode) => {
    setActiveMode(mode);
    if (mode !== 'merge') {
      clearMergeSelection(); // Clear merge selection when switching out of merge mode
    }
  };

  const getActiveModeLabel = () => {
    switch (activeMode) {
      case 'view':
        return 'View';
      case 'split':
        return 'Split';
      case 'merge':
        return `Merge (${mergeSelection.length})`;
      case 'convert':
        return 'Convert';
      case 'edit':
        return 'Edit';
      case 'compress':
        return 'Compress';
      case 'scan':
        return 'Scan';
      default:
        return 'Actions';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-[200px] justify-between">
          <span className="flex items-center gap-2">
            {activeMode === 'view' && <Eye className="h-4 w-4" />}
            {activeMode === 'split' && <SplitSquareVertical className="h-4 w-4" />}
            {activeMode === 'merge' && <Combine className="h-4 w-4" />}
            {activeMode === 'convert' && <Image className="h-4 w-4" />}
            {activeMode === 'edit' && <PenLine className="h-4 w-4" />}
            {activeMode === 'compress' && <Shrink className="h-4 w-4" />}
            {activeMode === 'scan' && <ScanLine className="h-4 w-4" />}
            {getActiveModeLabel()}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]" align="start">
        <DropdownMenuRadioGroup value={activeMode} onValueChange={(value) => handleModeChange(value as AppMode)}>
          <DropdownMenuRadioItem value="view">
            <Eye className="mr-2 h-4 w-4" />
            View
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="split">
            <SplitSquareVertical className="mr-2 h-4 w-4" />
            Split
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="merge">
            <Combine className="mr-2 h-4 w-4" />
            Merge {mergeSelection.length > 0 && `(${mergeSelection.length})`}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="convert">
            <Image className="mr-2 h-4 w-4" />
            Convert
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="edit">
            <PenLine className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="compress">
            <Shrink className="mr-2 h-4 w-4" />
            Compress
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="scan">
            <ScanLine className="mr-2 h-4 w-4" />
            Scan
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ActionToolbar;
