import { StateCreator } from 'zustand';
import { Annotation, AnnotationType, Bookmark } from '@/services/firestore';
import type { AppState } from '../useAppStore';

export interface AnnotationSlice {
  annotations: Annotation[];
  bookmarks: Bookmark[];
  activeEditTool: AnnotationType | null;
  selectedAnnotationId: string | null;
  selectedBookmarkId: string | null;

  setActiveEditTool: (tool: AnnotationType | null) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  setSelectedAnnotationId: (id: string | null) => void;
  clearAnnotations: (type?: AnnotationType) => void;
  setAnnotations: (annotations: Annotation[]) => void;

  addBookmark: (pageNumber: number) => void;
  removeBookmark: (id: string) => void;
  toggleBookmark: (pageNumber: number) => void;
  updateBookmark: (id: string, updates: Partial<Bookmark>) => void;
  setBookmarks: (bookmarks: Bookmark[]) => void;
  setSelectedBookmarkId: (id: string | null) => void;
}

export const createAnnotationSlice: StateCreator<AppState, [], [], AnnotationSlice> = (set) => ({
  annotations: [],
  bookmarks: [],
  activeEditTool: null,
  selectedAnnotationId: null,
  selectedBookmarkId: null,

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
    set((state) => {
      if (state.selectedAnnotationId === id && id !== null) {
        return { selectedAnnotationId: null, selectedBookmarkId: null };
      }
      return { selectedAnnotationId: id, selectedBookmarkId: null };
    }),

  clearAnnotations: (type?: AnnotationType) =>
    set((state) => ({
      annotations: type
        ? state.annotations.filter((a) => a.type !== type)
        : [],
      selectedAnnotationId: null,
    })),

  setAnnotations: (annotations) => set({ annotations }),

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

  setBookmarks: (bookmarks) =>
    set({ bookmarks: bookmarks.sort((a, b) => a.pageNumber - b.pageNumber) }),

  setSelectedBookmarkId: (id) =>
    set((state) => {
      if (state.selectedBookmarkId === id && id !== null) {
        return { selectedBookmarkId: null, selectedAnnotationId: null };
      }
      return { selectedBookmarkId: id, selectedAnnotationId: null };
    }),
});
