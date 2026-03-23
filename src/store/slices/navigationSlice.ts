import { StateCreator } from 'zustand';
import type { AppState, AppMode } from '../useAppStore';

export interface NavigationSlice {
  activeMode: AppMode;
  mergeSelection: string[];

  setActiveMode: (mode: AppMode) => void;
  addFileToMergeSelection: (fileId: string) => void;
  removeFileFromMergeSelection: (fileId: string) => void;
  reorderMergeSelection: (startIndex: number, endIndex: number) => void;
  clearMergeSelection: () => void;
}

export const createNavigationSlice: StateCreator<AppState, [], [], NavigationSlice> = (set) => ({
  activeMode: 'view' as AppMode,
  mergeSelection: [],

  setActiveMode: (mode) => set({ activeMode: mode }),

  addFileToMergeSelection: (fileId) =>
    set((state) => ({ mergeSelection: [...state.mergeSelection, fileId] })),

  removeFileFromMergeSelection: (fileId) =>
    set((state) => ({
      mergeSelection: state.mergeSelection.filter((id) => id !== fileId),
    })),

  reorderMergeSelection: (startIndex, endIndex) =>
    set((state) => {
      const result = Array.from(state.mergeSelection);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return { mergeSelection: result };
    }),

  clearMergeSelection: () => set({ mergeSelection: [] }),
});
