// src/components/dashboard/ActionToolbar.tsx
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { useAppStore, AppMode } from '@/store/useAppStore';
import { SplitSquareVertical, Combine, Image } from 'lucide-react';
import { toast } from 'sonner';

const ActionToolbar = () => {
  const { setActiveMode, activeMode, mergeSelection, clearMergeSelection } = useAppStore();

  const handleModeChange = (mode: AppMode) => {
    setActiveMode(mode);
    if (mode !== 'merge') {
      clearMergeSelection(); // Clear merge selection when switching out of merge mode
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
      <Button
        variant={activeMode === 'split' ? 'secondary' : 'ghost'}
        onClick={() => handleModeChange('split')}
      >
        <SplitSquareVertical className="mr-2 h-4 w-4" />
        Split
      </Button>
      <Button
        variant={activeMode === 'merge' ? 'secondary' : 'ghost'}
        onClick={() => handleModeChange('merge')}
      >
        <Combine className="mr-2 h-4 w-4" />
        Merge ({mergeSelection.length})
      </Button>
      <Button
        variant={activeMode === 'convert' ? 'secondary' : 'ghost'}
        onClick={() => handleModeChange('convert')}
      >
        <Image className="mr-2 h-4 w-4" />
        Convert
      </Button>
    </div>
  );
};

export default ActionToolbar;
