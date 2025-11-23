// src/store/useAppStore.ts
import { create } from 'zustand';
import { FileMetadata } from '@/services/firestore'; // Assuming FileMetadata is defined here

export type AppMode = 'view' | 'split' | 'merge' | 'convert' | 'edit';

export type AnnotationType = 'text' | 'signature';

export interface Annotation {
  id: string;
  pageNumber: number;
  type: AnnotationType;
  position: { x: number; y: number }; // Relative coordinates (0-1)
  content: string; // Text content or base64 signature image
  style?: {
    fontSize?: number;
    fontColor?: string;
    width?: number;
    height?: number;
  };
}

interface AppState {
  selectedFileId: string | null;
  activeMode: AppMode;
  files: FileMetadata[];
  mergeSelection: string[];
  // Annotation state
  annotations: Annotation[];
  activeEditTool: AnnotationType;
  selectedAnnotationId: string | null;

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
  reset: () => void;
}

const initialState = {
  selectedFileId: null,
  activeMode: 'view' as AppMode,
  files: [],
  mergeSelection: [],
  annotations: [] as Annotation[],
  activeEditTool: 'signature' as AnnotationType,
  selectedAnnotationId: null,
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
  setSelectedAnnotationId: (id) => set({ selectedAnnotationId: id }),
  clearAnnotations: () => set({ annotations: [], selectedAnnotationId: null }),
  reset: () => set(initialState),
}));
