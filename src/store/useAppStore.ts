// src/store/useAppStore.ts
import { create } from 'zustand';
import { Annotation, AnnotationType, Bookmark } from '@/services/firestore';
// Re-export types
export type { Annotation, AnnotationType, Bookmark };

export type AppMode = 'view' | 'split' | 'merge' | 'convert' | 'edit' | 'compress' | 'scan';

import { createFileSlice, FileSlice } from './slices/fileSlice';
import { createNavigationSlice, NavigationSlice } from './slices/navigationSlice';
import { createAnnotationSlice, AnnotationSlice } from './slices/annotationSlice';
import { createCompressionSlice, CompressionSlice } from './slices/compressionSlice';
import { createLocaleSlice, LocaleSlice } from './slices/localeSlice';
export type { Locale } from './slices/localeSlice';

export type AppState = FileSlice & NavigationSlice & AnnotationSlice & CompressionSlice & LocaleSlice & {
  reset: () => void;
};

const initialState = {
  selectedFileId: null,
  activeMode: 'view' as AppMode,
  files: [],
  currentFolderId: null,
  mergeSelection: [],
  annotations: [] as Annotation[],
  bookmarks: [] as Bookmark[],
  activeEditTool: null,
  selectedAnnotationId: null,
  selectedBookmarkId: null,
  isCompressing: false,
  compressAbortController: null,
};

export const useAppStore = create<AppState>()((set, get, store) => ({
  ...createFileSlice(set, get, store),
  ...createNavigationSlice(set, get, store),
  ...createAnnotationSlice(set, get, store),
  ...createCompressionSlice(set, get, store),
  ...createLocaleSlice(set, get, store),

  reset: () => set(initialState),
}));
