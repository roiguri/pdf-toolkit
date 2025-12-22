// src/store/useAppStore.ts
import { create } from 'zustand';
import { FileMetadata, Annotation, AnnotationType, Bookmark } from '@/services/firestore';
// Re-export types
export type { Annotation, AnnotationType, Bookmark };

export type AppMode = 'view' | 'split' | 'merge' | 'convert' | 'edit' | 'compress';

interface AppState {
  selectedFileId: string | null;
  activeMode: AppMode;
  files: FileMetadata[];
  mergeSelection: string[];
  // Annotation state
  annotations: Annotation[];
  bookmarks: Bookmark[];
  activeEditTool: AnnotationType;
  selectedAnnotationId: string | null;
  selectedBookmarkId: string | null;
  // Compression state
  isCompressing: boolean;
  compressAbortController: AbortController | null;

  // Folder state
  currentFolderId: string | null;
  setCurrentFolderId: (id: string | null) => void;

  setSelectedFileId: (id: string | null) => void;
  setActiveMode: (mode: AppMode) => void;
  setFiles: (files: FileMetadata[]) => void;
  addFileToMergeSelection: (fileId: string) => void;
  removeFileFromMergeSelection: (fileId: string) => void;
  reorderMergeSelection: (startIndex: number, endIndex: number) => void;
  clearMergeSelection: () => void;
  // Annotation actions
  setActiveEditTool: (tool: AnnotationType) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  setSelectedAnnotationId: (id: string | null) => void;
  clearAnnotations: () => void;
  setAnnotations: (annotations: Annotation[]) => void;
  // Bookmark actions
  addBookmark: (pageNumber: number) => void;
  removeBookmark: (id: string) => void;
  toggleBookmark: (pageNumber: number) => void;
  updateBookmark: (id: string, updates: Partial<Bookmark>) => void;
  setBookmarks: (bookmarks: Bookmark[]) => void;
  setSelectedBookmarkId: (id: string | null) => void;

  // Compression actions
  setCompressionStatus: (isCompressing: boolean, controller?: AbortController | null) => void;
  reset: () => void;
}

const initialState = {
  selectedFileId: null,
  activeMode: 'view' as AppMode,
  files: [],
  currentFolderId: null, // Default to root
  mergeSelection: [],
  annotations: [] as Annotation[],
  bookmarks: [] as Bookmark[],
  activeEditTool: 'signature' as AnnotationType,
  selectedAnnotationId: null,
  selectedBookmarkId: null,
  isCompressing: false,
  compressAbortController: null,
};

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  setCurrentFolderId: (id) => set({ currentFolderId: id }),
  setSelectedFileId: (id) => {
    // When file changes, try to load its annotations and bookmarks
    const state = get();
    const file = state.files.find((f) => f.id === id);
    set({
      selectedFileId: id,
      annotations: file?.annotations || [],
      bookmarks: file?.bookmarks || [],
    });
  },
  setActiveMode: (mode) => set({ activeMode: mode }),
  setFiles: (files) => {
    // When files list updates (e.g. from firestore subscription), update annotations/bookmarks for current file
    set((state) => {
      const currentFile = files.find((f) => f.id === state.selectedFileId);
      return {
        files,
        annotations: currentFile?.annotations || state.annotations,
        bookmarks: currentFile?.bookmarks || state.bookmarks,
      };
    });
  },
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
  // Annotation actions
  setActiveEditTool: (tool) => set({ activeEditTool: tool }),
  addAnnotation: (annotation) =>
    set((state) => ({ annotations: [...state.annotations, annotation] })),
  updateAnnotation: (id, updates) =>
    set((state) => ({
      annotations: state.annotations.map((ann) =>
        ann.id === id ? { ...ann, ...updates } : ann
      ),
    })),
  deleteAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((ann) => ann.id !== id),
      selectedAnnotationId: state.selectedAnnotationId === id ? null : state.selectedAnnotationId,
    })),
  setSelectedAnnotationId: (id) =>
    set({ selectedAnnotationId: id, selectedBookmarkId: null }), // Clear bookmark selection
  clearAnnotations: () => set({ annotations: [], selectedAnnotationId: null }),
  setAnnotations: (annotations) => set({ annotations }),

  // Bookmark actions
  addBookmark: (pageNumber) =>
    set((state) => {
      if (state.bookmarks.some((b) => b.pageNumber === pageNumber)) return state;
      const newBookmark: Bookmark = {
        id: crypto.randomUUID(),
        pageNumber,
        title: `Page ${pageNumber}`,
        createdAt: Date.now(),
      };
      return { bookmarks: [...state.bookmarks, newBookmark].sort((a, b) => a.pageNumber - b.pageNumber) };
    }),
  removeBookmark: (id) =>
    set((state) => ({ bookmarks: state.bookmarks.filter((b) => b.id !== id) })),
  toggleBookmark: (pageNumber) =>
    set((state) => {
      const existing = state.bookmarks.find((b) => b.pageNumber === pageNumber);
      if (existing) {
        return { bookmarks: state.bookmarks.filter((b) => b.id !== existing.id) };
      }
      const newBookmark: Bookmark = {
        id: crypto.randomUUID(),
        pageNumber,
        title: `Page ${pageNumber}`,
        createdAt: Date.now(),
      };
      return { bookmarks: [...state.bookmarks, newBookmark].sort((a, b) => a.pageNumber - b.pageNumber) };
    }),
  updateBookmark: (id, updates) =>
    set((state) => ({
      bookmarks: state.bookmarks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),
  setBookmarks: (bookmarks) => set({ bookmarks: bookmarks.sort((a, b) => a.pageNumber - b.pageNumber) }),
  setSelectedBookmarkId: (id) =>
    set({ selectedBookmarkId: id, selectedAnnotationId: null }), // Clear annotation selection

  // Compression actions
  setCompressionStatus: (isCompressing, controller = null) =>
    set({ isCompressing, compressAbortController: controller }),
  reset: () => set(initialState),
}));
