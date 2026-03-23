import { StateCreator } from 'zustand';
import type { AppState } from '../useAppStore';

export interface CompressionSlice {
  isCompressing: boolean;
  compressAbortController: AbortController | null;

  setCompressionStatus: (isCompressing: boolean, controller?: AbortController | null) => void;
}

export const createCompressionSlice: StateCreator<AppState, [], [], CompressionSlice> = (set) => ({
  isCompressing: false,
  compressAbortController: null,

  setCompressionStatus: (isCompressing, controller = null) =>
    set({ isCompressing, compressAbortController: controller }),
});
