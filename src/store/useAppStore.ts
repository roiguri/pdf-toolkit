// src/store/useAppStore.ts
import { create } from 'zustand';
import { FileMetadata } from '@/services/firestore'; // Assuming FileMetadata is defined here

export type AppMode = 'view' | 'split' | 'merge' | 'convert';

interface AppState {
  selectedFileId: string | null;
  activeMode: AppMode;
  files: FileMetadata[];
  mergeSelection: string[];
  // Other potential UI states like loading, errors etc. can be added later

  setSelectedFileId: (id: string | null) => void;
  setActiveMode: (mode: AppMode) => void;
  setFiles: (files: FileMetadata[]) => void;
  addFileToMergeSelection: (fileId: string) => void;
  removeFileFromMergeSelection: (fileId: string) => void;
  clearMergeSelection: () => void;
  reset: () => void;
}

const initialState = {
  selectedFileId: null,
  activeMode: 'view' as AppMode,
  files: [],
  mergeSelection: [],
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setSelectedFileId: (id) => set({ selectedFileId: id }),
  setActiveMode: (mode) => set({ activeMode: mode }),
  setFiles: (files) => set({ files }),
  addFileToMergeSelection: (fileId) =>
    set((state) => ({ mergeSelection: [...state.mergeSelection, fileId] })),
  removeFileFromMergeSelection: (fileId) =>
    set((state) => ({
      mergeSelection: state.mergeSelection.filter((id) => id !== fileId),
    })),
  clearMergeSelection: () => set({ mergeSelection: [] }),
  reset: () => set(initialState),
}));
