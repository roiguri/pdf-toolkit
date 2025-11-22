// src/components/ui/spinner.tsx
import React from 'react';
import { Loader2 } from 'lucide-react'; // Assuming lucide-react is installed

export const Spinner = () => {
  return (
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  );
};
