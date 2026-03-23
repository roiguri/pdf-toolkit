'use client';

import { FileMetadata } from '@/services/firestore';
import { useAppStore } from '@/store/useAppStore';
import { PDFViewer } from '@/components/pdf/PDFViewer';

interface ViewToolProps {
  file: FileMetadata;
}

const ViewTool = ({ file }: ViewToolProps) => {
  const { annotations, bookmarks, selectedAnnotationId, selectedBookmarkId, setSelectedAnnotationId, setSelectedBookmarkId, toggleBookmark } = useAppStore();

  return (
    <PDFViewer
      file={file}
      annotations={annotations}
      bookmarks={bookmarks}
      selectedAnnotationId={selectedAnnotationId}
      selectedBookmarkId={selectedBookmarkId}
      onAnnotationSelect={setSelectedAnnotationId}
      onBookmarkToggle={toggleBookmark}
      onBookmarkSelect={setSelectedBookmarkId}
    />
  );
};

export default ViewTool;
