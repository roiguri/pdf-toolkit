import { StateCreator } from 'zustand';
import { FileMetadata } from '@/services/firestore';
import type { AppState } from '../useAppStore';

export interface FileSlice {
  selectedFileId: string | null;
  files: FileMetadata[];
  currentFolderId: string | null;

  setSelectedFileId: (id: string | null) => void;
  setFiles: (files: FileMetadata[]) => void;
  setCurrentFolderId: (id: string | null) => void;
}

export const createFileSlice: StateCreator<AppState, [], [], FileSlice> = (set, get) => ({
  selectedFileId: null,
  files: [],
  currentFolderId: null,

  setSelectedFileId: (id) => {
    const file = get().files.find((f) => f.id === id);
    set({
      selectedFileId: id,
      annotations: file?.annotations || [],
      bookmarks: file?.bookmarks || [],
    });
  },

  setFiles: (files) => {
    // We update the files list, but we DO NOT overwrite the currently active 'annotations'
    // or 'bookmarks' with the data from 'files'.
    // The local state (state.annotations) is the source of truth while the user is editing.
    // Overwriting it with server data (which might be slightly stale or just echoing back)
    // causes race conditions where local changes are lost/reverted.
    set({ files });
  },

  setCurrentFolderId: (id) => set({ currentFolderId: id }),
});
